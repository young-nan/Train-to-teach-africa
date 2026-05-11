/**
 * src/services/tiersService.js
 *
 * Subscription tiers — formerly hard-coded constants on the pricing page,
 * now stored in the database so super_admin can edit them without a deploy.
 *
 * Public reads (no auth) only return active tiers. Super admin reads return
 * all (including inactive) and can write.
 */

import { supabase } from '@/lib/supabase';
import { logAuditEvent } from './auditService';

/**
 * Returns active tiers for a curriculum. Used by the public pricing page
 * and by the in-app subscription chooser.
 */
export async function listActiveTiers({ curriculum } = {}) {
  let q = supabase
    .from('subscription_tiers')
    .select('*')
    .eq('active', true)
    .order('curriculum')
    .order('display_order');
  if (curriculum) q = q.eq('curriculum', curriculum);
  const { data, error } = await q;
  if (error) throw new Error(`Could not load tiers: ${error.message}`);
  return data ?? [];
}

/**
 * Super-admin: list all tiers including inactive.
 */
export async function listAllTiers() {
  const { data, error } = await supabase
    .from('subscription_tiers')
    .select('*')
    .order('curriculum')
    .order('display_order');
  if (error) throw new Error(`Could not load tiers: ${error.message}`);
  return data ?? [];
}

/**
 * Super-admin: update price/active/etc. The (curriculum, audience, period)
 * tuple is the immutable identity; everything else is editable.
 */
export async function updateTier({ id, patch }) {
  // Whitelist editable fields so the form can't accidentally smuggle
  // identity-tuple changes through.
  const allowed = {};
  for (const k of ['name', 'price_minor', 'currency', 'description',
                   'paystack_plan_code', 'active', 'display_order']) {
    if (k in patch) allowed[k] = patch[k];
  }

  const { data, error } = await supabase
    .from('subscription_tiers')
    .update(allowed)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(`Could not update tier: ${error.message}`);

  logAuditEvent({
    action: 'tier.updated',
    details: { tier_id: id, changes: Object.keys(allowed) },
  });
  return data;
}

/**
 * Format minor units as a display price. Doesn't include the unit prefix
 * (₦ / $) — caller adds based on currency.
 */
export function formatPrice(minor, currency) {
  if (currency === 'USD') {
    return (minor / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  // NGN: thousands separators, no decimals
  return Math.round(minor / 100).toLocaleString('en-NG');
}
