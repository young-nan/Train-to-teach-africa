// supabase/functions/confirm-session/index.ts
//
// Confirms a tutoring session is complete and triggers the payout flow.
// This is the financial settlement point — do not simplify.
//
// WHO CALLS THIS
// ──────────────
// Three actors can trigger session completion:
//
//   1. TUTOR — marks complete after delivering the session.
//   2. PARENT — confirms receipt (optional; UI shows a "confirm session"
//      button after the scheduled end time).
//   3. TIMEOUT — a pg_cron job (see migration 0005 addendum) calls this
//      48 hours after session_date + start_time if neither party has
//      acted. This prevents abandoned bookings blocking payouts forever.
//
// Only one path needs to win — the RPC handles the race with a row lock.
//
// PAYOUT FLOW
// ───────────
// confirm_session_complete RPC:
//   1. Flips booking → 'completed'
//   2. Writes payout_ledger row (payout_status: 'pending')
// Then this function:
//   3. Initiates Paystack Transfer to tutor's recipient code
//   4. Updates payout_ledger.payout_status → 'initiated'
//      (or 'failed' with error for ops visibility)
//
// Paystack Transfer webhook (handled by a future verify-payout fn):
//   5. Flips payout_ledger → 'paid' when transfer succeeds.
//
// IDEMPOTENCY
// ───────────
// The RPC enforces booking.status = 'confirmed' before proceeding.
// If called twice (e.g. both tutor and timeout trigger within seconds),
// the second call raises an exception which this function catches and
// returns as { ok: true, already_completed: true } — not an error.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  // ── 1. Auth — tutor, parent, or service role (timeout) ───────────────────
  const authHeader = req.headers.get('Authorization') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const isServiceRole = authHeader.includes(serviceKey);

  const anonClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    serviceKey,
  );

  let callerUserId: string | null = null;
  if (!isServiceRole) {
    const { data: { user }, error } = await anonClient.auth.getUser();
    if (error || !user) return json({ error: 'Unauthorized' }, 401);
    callerUserId = user.id;
  }

  // ── 2. Parse body ─────────────────────────────────────────────────────────
  let body: { booking_id?: string; confirmed_by?: string };
  try { body = await req.json(); }
  catch { return json({ error: 'Invalid JSON' }, 400); }

  const { booking_id } = body;
  if (!booking_id) return json({ error: 'booking_id is required' }, 400);

  // ── 3. Authorisation — must be the tutor, parent, or service role ─────────
  if (!isServiceRole && callerUserId) {
    const { data: booking } = await serviceClient
      .from('bookings')
      .select('parent_user_id, tutors(user_id)')
      .eq('id', booking_id)
      .single();

    if (!booking) return json({ error: 'Booking not found' }, 404);

    const isTutor  = (booking.tutors as any)?.user_id === callerUserId;
    const isParent = booking.parent_user_id === callerUserId;

    if (!isTutor && !isParent) return json({ error: 'Forbidden' }, 403);
  }

  // ── 4. Determine confirmed_by label ───────────────────────────────────────
  let confirmedBy = body.confirmed_by ?? 'unknown';
  if (isServiceRole && !body.confirmed_by) confirmedBy = 'timeout';

  // ── 5. Call the atomic RPC ────────────────────────────────────────────────
  const { error: rpcErr } = await serviceClient.rpc('confirm_session_complete', {
    p_booking_id:   booking_id,
    p_confirmed_by: confirmedBy,
  });

  if (rpcErr) {
    // RPC raises an exception if booking is already completed — not an error.
    if (rpcErr.message?.includes('expected confirmed')) {
      return json({ ok: true, already_completed: true });
    }
    console.error('[confirm-session] RPC error:', rpcErr.message);
    return json({ error: 'Could not complete session' }, 500);
  }

  // ── 6. Initiate Paystack Transfer to tutor ────────────────────────────────
  // Load the payout_ledger row that the RPC just created.
  const { data: ledger } = await serviceClient
    .from('payout_ledger')
    .select('id, tutor_id, net_minor, currency')
    .eq('booking_id', booking_id)
    .single();

  if (!ledger) {
    // RPC succeeded but ledger row missing — should never happen, but log it.
    console.error('[confirm-session] payout_ledger row missing for booking', booking_id);
    return json({ ok: true, payout_initiated: false, warning: 'ledger_row_missing' });
  }

  // Get the tutor's Paystack recipient code (stored on their profile after
  // KYC — tutor onboarding sets this via a future /app/tutor/payout-setup flow).
  const { data: tutor } = await serviceClient
    .from('tutors')
    .select('paystack_recipient_code, full_name')
    .eq('id', ledger.tutor_id)
    .single();

  if (!tutor?.paystack_recipient_code) {
    // Tutor hasn't set up payouts yet — queue for manual processing.
    await serviceClient
      .from('payout_ledger')
      .update({ payout_status: 'pending' })  // stays pending, ops picks it up
      .eq('id', ledger.id);

    return json({
      ok:              true,
      payout_initiated: false,
      warning:         'tutor_no_recipient_code',
    });
  }

  // Initiate the Paystack Transfer.
  const paystackKey = Deno.env.get('PAYSTACK_SECRET_KEY');
  const transferRef = `TTA-PAY-${crypto.randomUUID().replace(/-/g, '').substring(0, 14).toUpperCase()}`;

  const transferRes = await fetch('https://api.paystack.co/transfer', {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${paystackKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      source:         'balance',
      amount:         ledger.net_minor,
      currency:       ledger.currency,
      recipient:      tutor.paystack_recipient_code,
      reason:         `TTA session payout — booking ${booking_id}`,
      reference:      transferRef,
    }),
  });

  const transferBody = await transferRes.json() as {
    status: boolean;
    data?:  { transfer_code: string };
    message?: string;
  };

  if (transferRes.ok && transferBody.status) {
    await serviceClient
      .from('payout_ledger')
      .update({
        payout_status:        'initiated',
        payout_reference:     transferRef,
        payout_initiated_at:  new Date().toISOString(),
      })
      .eq('id', ledger.id);

    return json({ ok: true, payout_initiated: true, transfer_reference: transferRef });
  }

  // Transfer failed — mark it so ops can retry manually.
  console.error('[confirm-session] Paystack Transfer failed:', transferBody.message);
  await serviceClient
    .from('payout_ledger')
    .update({ payout_status: 'failed' })
    .eq('id', ledger.id);

  // Session is still completed — the payout failure is an ops issue, not a
  // user-facing error. We return ok:true so the UI shows "session complete".
  return json({
    ok:              true,
    payout_initiated: false,
    warning:         'payout_transfer_failed',
  });
});
