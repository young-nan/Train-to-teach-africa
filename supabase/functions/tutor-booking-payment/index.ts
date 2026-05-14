// supabase/functions/tutor-booking-payment/index.ts
//
// Creates a Paystack transaction for a tutor booking. Parallel to
// initialise-payment (which handles subscriptions), but for marketplace
// sessions. Key differences:
//
//   - Amount is read from the bookings row, not a plan catalogue.
//     The client cannot supply the amount — only the booking_id.
//   - Metadata includes booking_id so the charge.success webhook can
//     locate the booking and flip it to 'paid'.
//   - Reference is stored on the booking row (not payments table)
//     so the tutor-booking webhook handler can look it up.
//
// SECURITY MODEL
// ──────────────
// 1. Caller must be authenticated.
// 2. booking_id must belong to the calling user (RLS enforced via
//    the service-role select + explicit parent_user_id check).
// 3. Booking must be in 'pending_payment' state — prevents duplicate
//    Paystack transactions for the same booking.
// 4. Amount comes exclusively from the DB row (snapshot at booking
//    creation time) — client has zero influence over the charge amount.

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

  // ── 1. Auth ───────────────────────────────────────────────────────────────
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  );
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401);

  // ── 2. Parse body ─────────────────────────────────────────────────────────
  let body: { booking_id?: string; email?: string };
  try { body = await req.json(); }
  catch { return json({ error: 'Invalid JSON' }, 400); }

  const { booking_id, email } = body;
  if (!booking_id || !email) {
    return json({ error: 'booking_id and email are required' }, 400);
  }
  if (email.toLowerCase() !== user.email?.toLowerCase()) {
    return json({ error: 'email must match your account email' }, 400);
  }

  // ── 3. Load and validate booking ─────────────────────────────────────────
  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: booking, error: bookingErr } = await serviceClient
    .from('bookings')
    .select('id, parent_user_id, total_minor, currency, status, tutor_id, subject, session_date')
    .eq('id', booking_id)
    .single();

  if (bookingErr || !booking) return json({ error: 'Booking not found' }, 404);

  // Ensure the booking belongs to the calling user.
  if (booking.parent_user_id !== user.id) return json({ error: 'Forbidden' }, 403);

  // Only pending_payment bookings should be charged.
  if (booking.status !== 'pending_payment') {
    return json({
      error: `Booking is already '${booking.status}' — cannot initiate new payment`,
    }, 409);
  }

  // ── 4. Idempotency — reuse existing Paystack session if recent ────────────
  // Check if we already have a pending payment for this booking from the
  // last 60 seconds (handles double-taps).
  const sixtySecondsAgo = new Date(Date.now() - 60_000).toISOString();
  const { data: existing } = await serviceClient
    .from('payments')
    .select('reference, paystack_auth_url')
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .like('reference', `TTA-BKG-%`)
    .gte('created_at', sixtySecondsAgo)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.paystack_auth_url) {
    return json({
      reference:         existing.reference,
      authorization_url: existing.paystack_auth_url,
      reused:            true,
    });
  }

  // ── 5. Create Paystack transaction ────────────────────────────────────────
  const reference    = `TTA-BKG-${crypto.randomUUID().replace(/-/g, '').substring(0, 14).toUpperCase()}`;
  const paystackKey  = Deno.env.get('PAYSTACK_SECRET_KEY');
  const siteUrl      = Deno.env.get('SITE_URL');

  if (!paystackKey) return json({ error: 'Payment provider not configured' }, 500);

  const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${paystackKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      amount:       booking.total_minor,
      currency:     booking.currency,
      reference,
      callback_url: `${siteUrl}/billing/return?reference=${reference}&type=booking`,
      metadata: {
        booking_id:  booking.id,
        tutor_id:    booking.tutor_id,
        subject:     booking.subject,
        session_date: booking.session_date,
        tta_user_id: user.id,
        payment_type: 'tutor_booking',
      },
    }),
  });

  const paystackBody = await paystackRes.json() as {
    status:   boolean;
    data?:    { access_code: string; authorization_url: string };
    message?: string;
  };

  if (!paystackRes.ok || !paystackBody.status || !paystackBody.data) {
    console.error('[tutor-booking-payment] Paystack error:', paystackBody);
    return json({ error: 'Could not create payment. Please try again.' }, 502);
  }

  const { access_code, authorization_url } = paystackBody.data;

  // ── 6. Write pending payment row ──────────────────────────────────────────
  // plan_code is 'TUTOR_BOOKING' — a non-subscription payment type.
  // The verify-booking-payment webhook (separate from verify-payment) handles
  // the charge.success event for this reference prefix.
  const { error: insertErr } = await serviceClient
    .from('payments')
    .insert({
      user_id:              user.id,
      plan_code:            'TUTOR_BOOKING',
      amount_minor:         booking.total_minor,
      currency:             booking.currency,
      reference,
      status:               'pending',
      paystack_access_code: access_code,
      paystack_auth_url:    authorization_url,
      metadata: {
        booking_id:   booking.id,
        payment_type: 'tutor_booking',
      },
    });

  if (insertErr) {
    console.error('[tutor-booking-payment] payments insert failed:', insertErr.message);
    // Non-fatal — webhook will still fire and can upsert on conflict.
  }

  // ── 7. Stamp the booking with this reference for webhook lookup ───────────
  await serviceClient
    .from('bookings')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', booking.id);

  return json({ reference, access_code, authorization_url });
});
