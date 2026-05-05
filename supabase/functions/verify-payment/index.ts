// supabase/functions/verify-payment/index.ts
//
// Paystack webhook → verified payment → activated subscription.
//
// THIS IS THE MOST SECURITY-CRITICAL FILE IN THE CODEBASE.
//
// Responsibilities (per the brief, Part 6):
//   1. Verify webhook signature using PAYSTACK_WEBHOOK_SECRET (HMAC-SHA512).
//   2. Parse the event metadata.
//   3. Validate the plan code against the canonical pricing config.
//   4. Validate the amount paid matches the canonical plan amount.
//      (This is critical: a malicious actor cannot subscribe to ANNUAL
//      pricing by paying the TERM amount.)
//   5. Activate the subscription (idempotent — duplicate webhooks are fine).
//   6. Write a payment audit log.
//
// All logic runs in Deno; we cannot import the React client. Pricing values
// are duplicated below — kept in sync with src/config/pricing.js via a CI
// check (see ops/check-pricing-sync.mjs).

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { createHmac } from 'node:crypto';

// --- Pricing duplicate (kept in sync with src/config/pricing.js by CI) ----
const PLANS: Record<string, { amountMinor: number; currency: 'NGN' | 'USD' }> = {
  AFR_PARENT_TERM:    { amountMinor: 1084700,  currency: 'NGN' },
  AFR_PARENT_ANNUAL:  { amountMinor: 3118400,  currency: 'NGN' },
  AFR_TEACHER_TERM:   { amountMinor: 1220300,  currency: 'NGN' },
  AFR_SCHOOL_TERM:    { amountMinor: 6101200,  currency: 'NGN' },
  AFR_SCHOOL_ANNUAL:  { amountMinor: 17625600, currency: 'NGN' },
  INT_PARENT_TERM:    { amountMinor: 1200,     currency: 'USD' },
  INT_PARENT_ANNUAL:  { amountMinor: 3200,     currency: 'USD' },
  INT_TEACHER_TERM:   { amountMinor: 1400,     currency: 'USD' },
  INT_SCHOOL_TERM:    { amountMinor: 7500,     currency: 'USD' },
  INT_SCHOOL_ANNUAL:  { amountMinor: 25000,    currency: 'USD' },
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // ---- 1. Verify signature ------------------------------------------------
  // Paystack signs the body with HMAC-SHA512 using the webhook secret.
  const signature = req.headers.get('x-paystack-signature');
  if (!signature) return json({ error: 'Missing signature' }, 401);

  const rawBody = await req.text();
  const expected = createHmac('sha512', PAYSTACK_SECRET_KEY).update(rawBody).digest('hex');
  if (signature !== expected) {
    // Log without leaking — someone is probing the webhook.
    console.warn('[verify-payment] signature mismatch');
    return json({ error: 'Invalid signature' }, 401);
  }

  // ---- 2. Parse event -----------------------------------------------------
  let event: any;
  try { event = JSON.parse(rawBody); }
  catch { return json({ error: 'Invalid JSON' }, 400); }

  if (event.event !== 'charge.success') {
    // We only act on successful charges. Other events (transfer.success, etc.)
    // are acknowledged but ignored.
    return json({ ok: true, ignored: event.event });
  }

  const data = event.data;
  const reference = data?.reference;
  const planCode = data?.metadata?.plan_code;
  const userId = data?.metadata?.user_id;
  const amountFromPaystack = data?.amount; // minor units
  const currencyFromPaystack = data?.currency;

  if (!reference || !planCode || !userId) {
    return json({ error: 'Missing reference, plan_code, or user_id' }, 400);
  }

  // ---- 3. Validate plan ---------------------------------------------------
  const plan = PLANS[planCode];
  if (!plan) {
    await logSuspiciousAttempt({ reference, reason: 'unknown_plan_code', planCode });
    return json({ error: 'Unknown plan' }, 400);
  }

  // ---- 4. Validate amount + currency --------------------------------------
  // CRITICAL: never trust the amount Paystack sends without checking it
  // against our canonical plan amount. This blocks "subscribe to annual by
  // paying term amount" tampering.
  if (amountFromPaystack !== plan.amountMinor || currencyFromPaystack !== plan.currency) {
    await logSuspiciousAttempt({
      reference,
      reason: 'amount_or_currency_mismatch',
      planCode,
      expected: { amount: plan.amountMinor, currency: plan.currency },
      received: { amount: amountFromPaystack, currency: currencyFromPaystack },
    });
    return json({ error: 'Amount or currency mismatch' }, 400);
  }

  // ---- 5. Activate subscription (idempotent) ------------------------------
  // Use the reference as the idempotency key. If the same webhook fires
  // twice, the unique constraint on payments.reference + the upsert below
  // make this a no-op.
  const { data: payment, error: payErr } = await supabase
    .from('payments')
    .upsert(
      {
        reference,
        user_id: userId,
        plan_code: planCode,
        amount_minor: amountFromPaystack,
        currency: currencyFromPaystack,
        status: 'verified',
        paystack_event: data,
        verified_at: new Date().toISOString(),
      },
      { onConflict: 'reference' },
    )
    .select()
    .single();

  if (payErr) {
    console.error('[verify-payment] payment upsert failed', payErr);
    return json({ error: 'Database error' }, 500);
  }

  // Activate / extend the subscription. The DB function below is the only
  // place that knows the cadence-to-period mapping (term = 13 weeks, annual
  // = 1 year). Centralising keeps date math out of TypeScript.
  const { data: subId, error: subErr } = await supabase.rpc('activate_subscription', {
    p_user_id: userId,
    p_plan_code: planCode,
    p_payment_id: payment.id,
  });
  if (subErr) {
    console.error('[verify-payment] activate_subscription failed', subErr);
    return json({ error: 'Could not activate subscription' }, 500);
  }

  // ---- 6. Audit log -------------------------------------------------------
  await supabase.from('audit_log').insert({
    actor: 'paystack_webhook',
    action: 'subscription.activated',
    target_user_id: userId,
    details: { reference, plan_code: planCode, subscription_id: subId, amount_minor: amountFromPaystack, currency: currencyFromPaystack },
  });

  return json({ ok: true, subscription_id: subId });
});

// ---- helpers --------------------------------------------------------------

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

async function logSuspiciousAttempt(details: Record<string, unknown>) {
  await supabase.from('audit_log').insert({
    actor: 'paystack_webhook',
    action: 'payment.suspicious',
    details,
  });
}
