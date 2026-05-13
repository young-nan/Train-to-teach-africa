/**
 * src/services/parentSubscriptionService.js
 *
 * Parent-side subscription flow:
 *   1. Parent picks a tier from /app/parent/subscribe
 *   2. startSubscribe() creates a pending_payment row in parent_subscriptions
 *      and calls the `initialise-payment` Edge Function to get a Paystack URL
 *   3. Browser redirects to Paystack; on payment Paystack fires the webhook
 *   4. verify-payment webhook handler calls activate_subscription RPC which:
 *      a. Creates a row in subscriptions
 *      b. Updates the matching parent_subscriptions row to 'active'
 *   5. pollVerificationStatus() (in paymentService.js) sees status=verified
 *      and routes the parent to their dashboard
 *
 * FIX (was broken): startSubscribe() was calling `verify-payment` with an
 * `action: 'initialize'` body that the webhook handler never handled. It now
 * calls `initialise-payment` — the dedicated function that creates a Paystack
 * transaction and returns authorization_url.
 */

import { supabase } from '@/lib/supabase';
import { logAuditEvent } from './auditService';

// ── Read ────────────────────────────────────────────────────────────────────

/**
 * Returns the parent's current active entitlement (if any).
 * Reads from the parent_current_entitlement view (created in migration 0003).
 * Returns null if the parent has no active subscription.
 */
export async function getEntitlement() {
  const { data, error } = await supabase
    .from('parent_current_entitlement')
    .select('*')
    .maybeSingle();
  if (error) {
    // Don't throw — the component degrades gracefully to "no entitlement".
    console.warn('[entitlement] getEntitlement failed:', error.message);
    return null;
  }
  return data;
}

/**
 * Check entitlement for a specific lesson (or globally).
 * Calls parent_has_entitlement RPC — cheap, safe to call on every lesson page.
 */
export async function hasEntitlement({ lessonId } = {}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return false;

  const { data, error } = await supabase.rpc('parent_has_entitlement', {
    p_parent_user_id: user.id,
    p_lesson_id: lessonId ?? null,
  });
  if (error) {
    console.warn('[entitlement] hasEntitlement RPC failed:', error.message);
    return false;
  }
  return !!data;
}

/**
 * Parent's subscription history (all statuses, newest first).
 * Joins subscription_tiers so the UI can display tier name + cadence.
 */
export async function listMySubscriptions() {
  const { data, error } = await supabase
    .from('parent_subscriptions')
    .select('*, subscription_tiers(name, curriculum, audience, period, price_minor, currency)')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Could not load subscriptions: ${error.message}`);
  return data ?? [];
}

// ── Write ───────────────────────────────────────────────────────────────────

/**
 * Begin the subscribe flow for a parent.
 *
 * Steps:
 *   1. Create a pending_payment row in parent_subscriptions (so the
 *      activate_subscription RPC can find it when the webhook fires).
 *   2. Call the `initialise-payment` Edge Function to create the Paystack
 *      transaction and get the authorization_url.
 *   3. Return { subscription, authorization_url, reference } to the caller,
 *      which redirects the browser to Paystack.
 *
 * If step 2 fails, the pending subscription is cancelled so it doesn't
 * strand. The parent can try again cleanly.
 *
 * @param {{ tier: object, childrenCovered?: number }} params
 * @returns {{ subscription: object, authorization_url: string, reference: string }}
 */
export async function startSubscribe({ tier, childrenCovered = 1 }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) throw new Error('Sign in before subscribing.');
  if (!user?.email) throw new Error('Your account has no email address. Contact support.');

  // Optimistic validity window for the pending row.
  // The webhook will reconfirm based on the actual payment timestamp.
  const validFrom = new Date();
  const validUntil = new Date(validFrom);
  if (tier.period === 'annual') {
    validUntil.setFullYear(validUntil.getFullYear() + 1);
  } else {
    // 'term' — 13 weeks (matches activate_subscription SQL)
    validUntil.setDate(validUntil.getDate() + 91);
  }

  // Step 1 — create pending subscription row.
  const { data: sub, error: subErr } = await supabase
    .from('parent_subscriptions')
    .insert({
      parent_user_id:   user.id,
      tier_id:          tier.id,
      children_covered: childrenCovered,
      valid_from:       validFrom.toISOString(),
      valid_until:      validUntil.toISOString(),
      status:           'pending_payment',
    })
    .select()
    .single();

  if (subErr) throw new Error(`Could not start subscription: ${subErr.message}`);

  logAuditEvent({
    action: 'parent_subscription.initiated',
    details: { tier_id: tier.id, subscription_id: sub.id, amount_minor: tier.price_minor },
  });

  // Step 2 — initialise Paystack transaction.
  // Calls `initialise-payment` (NOT `verify-payment`).
  // The plan_code is derived from the tier's canonical fields.
  const planCode = derivePlanCode(tier);
  if (!planCode) {
    await cancelPendingSub(sub.id);
    throw new Error(`Could not map tier to a plan code. Contact support.`);
  }

  const { data: payResult, error: payErr } = await supabase.functions.invoke('initialise-payment', {
    body: {
      plan_code: planCode,
      email:     user.email,
      metadata: {
        parent_subscription_id: sub.id,
        tier_id:                tier.id,
        tier_name:              tier.name,
        children_covered:       childrenCovered,
      },
    },
  });

  if (payErr || payResult?.error) {
    await cancelPendingSub(sub.id);
    throw new Error(payErr?.message ?? payResult?.error ?? 'Could not start payment. Try again.');
  }

  return {
    subscription:      sub,
    authorization_url: payResult.authorization_url,
    reference:         payResult.reference,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Maps a subscription_tiers row back to the canonical plan_code used in
 * src/config/pricing.js and the PLANS constant in initialise-payment.
 *
 * Tiers store (curriculum, audience, period) as the stable identity tuple.
 * This function reconstructs the plan_code string from those three fields.
 */
function derivePlanCode(tier) {
  const currPrefix = tier.curriculum === 'african' ? 'AFR' : 'INT';
  const audSegment = tier.audience.toUpperCase();
  const cadSuffix  = tier.period === 'annual' ? 'ANNUAL' : 'TERM';
  return `${currPrefix}_${audSegment}_${cadSuffix}`;
}

/**
 * Cancel a pending subscription row — called when the payment init fails
 * so we don't strand un-actionable rows.
 */
async function cancelPendingSub(subId) {
  try {
    await supabase
      .from('parent_subscriptions')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', subId);
  } catch (e) {
    console.warn('[parentSubscriptionService] failed to cancel pending sub', subId, e?.message);
  }
}
