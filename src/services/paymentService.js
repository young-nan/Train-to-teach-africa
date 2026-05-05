/**
 * src/services/paymentService.js
 *
 * Initiates a Paystack checkout. Verification happens server-side in the
 * Edge Function `verify-payment` — the client NEVER trusts a "success"
 * response from Paystack's inline modal. We always re-verify with the
 * webhook before granting access.
 *
 * The flow:
 *   1. Client calls `initialisePayment(plan)` — gets back a Paystack
 *      access_code from our server (which signs the request).
 *   2. Client opens Paystack's hosted page using that access_code.
 *   3. Paystack redirects user to /billing/return?reference=...
 *   4. /billing/return calls `pollVerificationStatus(reference)`.
 *   5. Meanwhile Paystack hits our webhook — Edge Function verifies the
 *      signature, marks the payment as verified, activates the subscription.
 *   6. The poll sees `status = active` and routes the user to their app.
 *
 * The user does NOT have access to anything until the webhook fires. This
 * prevents the entire class of "I closed the tab before redirect" bugs.
 */

import { supabase } from '@/lib/supabase';
import { PLANS } from '@/config/pricing';

/**
 * Ask the server to create a Paystack transaction for the given plan code.
 * Server validates plan code, generates a reference, returns access_code.
 */
export async function initialisePayment({ planCode, customerEmail, metadata = {} }) {
  const plan = PLANS[planCode];
  if (!plan) throw new Error('Unknown plan');

  const { data, error } = await supabase.functions.invoke('initialise-payment', {
    body: {
      plan_code: planCode,
      email: customerEmail,
      metadata, // school_id, parent_id, child_ids, etc.
    },
  });
  if (error) throw new Error(`Could not start payment: ${error.message}`);
  return data; // { reference, access_code, authorization_url }
}

/**
 * After Paystack redirect, poll for verification status. We poll instead of
 * single-shot because the webhook may take 1–4 seconds to arrive.
 */
export async function pollVerificationStatus(reference, { timeoutMs = 30000, intervalMs = 1500 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { data, error } = await supabase
      .from('payments')
      .select('status, subscription_id, failure_reason')
      .eq('reference', reference)
      .single();

    if (error) throw new Error(`Could not check payment: ${error.message}`);

    if (data.status === 'verified') return { ok: true, subscriptionId: data.subscription_id };
    if (data.status === 'failed') return { ok: false, reason: data.failure_reason ?? 'Payment failed' };
    // status === 'pending' — keep polling
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  // Timed out — webhook hasn't arrived yet. Tell the caller to keep waiting
  // on the dashboard; the subscription will activate when the webhook lands.
  return { ok: false, pending: true };
}

export async function listMyPayments() {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Could not load payments: ${error.message}`);
  return data;
}

export async function listMySubscriptions() {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Could not load subscriptions: ${error.message}`);
  return data;
}
