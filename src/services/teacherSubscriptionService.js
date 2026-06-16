/**
 * src/services/teacherSubscriptionService.js
 *
 * Solo teacher subscription flow.
 *
 * When a teacher signs up independently (not via a school), they need their
 * own subscription. On payment confirmation:
 *   1. A "solo school" is created in public.schools for them
 *   2. Their profiles.school_id is set to this solo school
 *   3. They can now use the full SIMS (attendance, grades, reports)
 *
 * Free tier (no subscription):
 *   - 3 demo lessons via get_demo_lessons()
 *   - Sample attendance sheet (read-only)
 *   - Sample report card template (read-only, no pupil data)
 *   - Upgrade prompts on all premium features
 */

import { supabase } from '@/lib/supabase';
import { logAuditEvent } from './auditService';

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * Returns the teacher's current subscription entitlement.
 * Returns null if no active subscription.
 */
export async function getTeacherEntitlement() {
  const { data, error } = await supabase
    .from('teacher_current_entitlement')
    .select('*')
    .maybeSingle();
  if (error) {
    console.warn('[teacher_entitlement] failed:', error.message);
    return null;
  }
  return data;
}

/**
 * Check if teacher has an active subscription.
 * Used by SIMS views to show premium vs demo content.
 */
export async function isTeacherSubscribed() {
  const entitlement = await getTeacherEntitlement();
  return entitlement?.is_active === true;
}

/**
 * Get 3 demo lessons for free tier preview.
 * @param {string} curriculum - 'african' or 'foreign'
 */
export async function getDemoLessons(curriculum = 'african') {
  const { data, error } = await supabase
    .rpc('get_demo_lessons', { p_curriculum: curriculum });
  if (error) throw new Error(`Could not load demo lessons: ${error.message}`);
  return data ?? [];
}

// ── Subscribe ─────────────────────────────────────────────────────────────────

/**
 * Initiate a teacher subscription payment.
 * Creates a pending teacher_subscriptions row and calls the
 * initialise-payment edge function for a Paystack URL.
 *
 * @param {{ tierId: string, curriculum: string }} options
 * @returns {{ authorizationUrl: string, reference: string, subscriptionId: string }}
 */
export async function startTeacherSubscription({ tierId, curriculum }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated.');

  // Create pending subscription row
  const { data: sub, error: subErr } = await supabase
    .from('teacher_subscriptions')
    .insert({
      teacher_user_id: user.id,
      tier_id:         tierId,
      status:          'pending_payment',
    })
    .select()
    .single();
  if (subErr) throw new Error(`Could not create subscription: ${subErr.message}`);

  // Call Paystack initialise via edge function
  const { data: payment, error: payErr } = await supabase.functions.invoke('initialise-payment', {
    body: {
      subscription_type: 'teacher',
      subscription_id:   sub.id,
      tier_id:           tierId,
      user_id:           user.id,
      email:             user.email,
      curriculum,
    },
  });
  if (payErr || !payment?.authorization_url) {
    throw new Error(payErr?.message ?? 'Payment initialisation failed.');
  }

  logAuditEvent({
    action:  'teacher_subscription.initiated',
    details: { subscription_id: sub.id, tier_id: tierId },
  });

  return {
    authorizationUrl: payment.authorization_url,
    reference:        payment.reference,
    subscriptionId:   sub.id,
  };
}
