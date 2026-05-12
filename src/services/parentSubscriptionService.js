/**
 * src/services/parentSubscriptionService.js
 *
 * Parent-side subscription flow:
 *   1. Parent picks a tier from /app/parent/subscribe
 *   2. We create a pending_payment row + call Paystack via the
 *      verify-payment edge function (which also initialises payments)
 *   3. On Paystack callback, the webhook flips status to 'active' and
 *      sets the validity window
 *   4. The parent's UI reflects the new entitlement immediately
 */

import { supabase } from '@/lib/supabase';
import { logAuditEvent } from './auditService';

/**
 * Returns the parent's current active entitlement (if any), plus
 * the next-tier upgrade options. Used by the parent dashboard.
 */
export async function getEntitlement() {
  const { data, error } = await supabase
    .from('parent_current_entitlement')
    .select('*')
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Could not check entitlement: ${error.message}`);
  return data; // null if no active subscription
}

/**
 * Check entitlement for a specific lesson (or globally).
 * Cheap server-side RPC — call from anywhere lesson access is gated.
 */
export async function hasEntitlement({ lessonId } = {}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return false;
  const { data, error } = await supabase.rpc('parent_has_entitlement', {
    p_parent_user_id: user.id,
    p_lesson_id: lessonId ?? null,
  });
  if (error) {
    console.warn('[entitlement] check failed:', error.message);
    return false;
  }
  return !!data;
}

/**
 * Parent's subscription history (all statuses, newest first).
 */
export async function listMySubscriptions() {
  const { data, error } = await supabase
    .from('parent_subscriptions')
    .select('*, subscription_tiers(name, curriculum, audience, period, price_minor, currency)')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Could not load subscriptions: ${error.message}`);
  return data ?? [];
}

/**
 * Begin the subscribe flow: create a pending_payment row and ask the
 * payment edge function to initialise a Paystack transaction.
 *
 * Returns { subscription, authorization_url } — the caller redirects
 * the browser to authorization_url; Paystack callback updates the row.
 */
export async function startSubscribe({ tier, childrenCovered = 1 }) {
  // Compute validity end-date locally for the pending row; the webhook
  // will reconfirm based on actual payment timestamp.
  const monthsByPeriod = { term: 4, annual: 12 };
  const months = monthsByPeriod[tier.period] ?? 4;
  const validFrom = new Date();
  const validUntil = new Date(validFrom);
  validUntil.setMonth(validUntil.getMonth() + months);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) throw new Error('Sign in first.');

  // Step 1: create pending subscription row
  const { data: sub, error: subErr } = await supabase
    .from('parent_subscriptions')
    .insert({
      parent_user_id: user.id,
      tier_id: tier.id,
      children_covered: childrenCovered,
      valid_from: validFrom.toISOString(),
      valid_until: validUntil.toISOString(),
      status: 'pending_payment',
    })
    .select()
    .single();
  if (subErr) throw new Error(`Could not start subscription: ${subErr.message}`);

  logAuditEvent({
    action: 'parent_subscription.initiated',
    details: { tier_id: tier.id, subscription_id: sub.id, amount: tier.price_minor },
  });

  // Step 2: call the payments edge function to initialise Paystack
  const { data: payResult, error: payErr } = await supabase.functions.invoke('verify-payment', {
    body: {
      action: 'initialize',
      reference_kind: 'parent_subscription',
      reference_id: sub.id,
      amount_minor: tier.price_minor,
      currency: tier.currency,
      metadata: {
        tier_id: tier.id,
        tier_name: tier.name,
        children_covered: childrenCovered,
      },
    },
  });
  if (payErr || payResult?.error) {
    // Rollback — mark the subscription as failed so we don't strand it
    await supabase
      .from('parent_subscriptions')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', sub.id);
    throw new Error(payErr?.message ?? payResult?.error ?? 'Payment init failed');
  }

  return {
    subscription: sub,
    authorization_url: payResult.authorization_url,
    reference: payResult.reference,
  };
}
