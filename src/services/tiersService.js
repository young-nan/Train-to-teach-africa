/**
 * src/services/tiersService.js
 *
 * Subscription tiers — database-backed pricing.
 *
 * CHANGES FROM PREVIOUS VERSION
 * ─────────────────────────────
 * - `listActiveTiers()` now accepts no arguments (fetches all active tiers).
 *   The pricing page needs all curricula in one call; filtering client-side
 *   is cheaper than two sequential queries with two round trips.
 * - `listActiveTiers({ curriculum })` still works exactly as before.
 * - `formatPrice(minor, currency)` is the canonical display formatter.
 *   It accepts the DB field names (minor, currency string) not the pricing.js
 *   plan object shape — so callers don't need to import pricing.js at all.
 */

import { supabase } from '@/lib/supabase';
import { logAuditEvent } from './auditService';

// ── Public reads (no auth required) ─────────────────────────────────────────

/**
 * Returns all active tiers, optionally filtered by curriculum.
 *
 * RLS policy `tiers_public_read` allows anon to read active = true rows,
 * so this works on the public /pricing page without an auth session.
 *
 * @param {{ curriculum?: string }} [opts]
 *   - curriculum: 'african' | 'foreign' | undefined (fetch all)
 * @returns {Promise<Array>}
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

// ── Admin reads (authenticated, super_admin only) ─────────────────────────────

/**
 * Super-admin: list all tiers including inactive.
 * Used by TiersView to show the full catalogue, including plans
 * that have been retired but kept for historical reference.
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

// ── Admin writes ──────────────────────────────────────────────────────────────

/**
 * Super-admin: update a tier's editable fields.
 *
 * The (curriculum, audience, period) identity tuple is immutable — changing
 * it would break historical subscription records. Only operational fields
 * (price, name, description, active status, display order) can be changed.
 *
 * @param {{ id: string, patch: object }} params
 */
export async function updateTier({ id, patch }) {
  const EDITABLE = [
    'name', 'description', 'price_minor', 'currency',
    'paystack_plan_code', 'active', 'display_order',
  ];

  const allowed = Object.fromEntries(
    Object.entries(patch).filter(([k]) => EDITABLE.includes(k)),
  );

  if (Object.keys(allowed).length === 0) {
    throw new Error('No editable fields provided.');
  }

  const { data, error } = await supabase
    .from('subscription_tiers')
    .update({ ...allowed, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Could not update tier: ${error.message}`);

  logAuditEvent({
    action:  'tier.updated',
    details: { tier_id: id, changes: Object.keys(allowed) },
  });

  return data;
}

// ── Formatting ────────────────────────────────────────────────────────────────

/**
 * Format minor units as a display string WITHOUT the currency prefix.
 * Caller adds the prefix (₦ or $) based on the currency field.
 *
 * This is the canonical formatter for DB-sourced prices.
 * It accepts the DB field names (minor integer, currency string).
 *
 * For pricing.js plan objects use formatPrice() from pricing.js instead.
 *
 * @param {number} minor   - amount in minor units (kobo / cents)
 * @param {string} currency - 'NGN' | 'USD'
 * @returns {string} e.g. "10,847" (NGN) or "12.00" (USD)
 */
export function formatPrice(minor, currency) {
  if (currency === 'USD') {
    return (minor / 100).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  // NGN: whole numbers, thousands separator, no decimal
  return Math.round(minor / 100).toLocaleString('en-NG');
}

/**
 * Derive a plan code from a DB tier row.
 * Mirrors derivePlanCode() in PricingPage.jsx and parentSubscriptionService.js.
 * Centralised here so it's one source of truth.
 *
 * DB stores: curriculum ('african'|'foreign'), audience, period ('term'|'annual')
 * Returns:   'AFR_PARENT_TERM', 'INT_SCHOOL_ANNUAL', etc.
 */
export function derivePlanCode(tier) {
  const prefix  = tier.curriculum === 'african' ? 'AFR' : 'INT';
  const aud     = (tier.audience ?? '').toUpperCase();
  const cadence = tier.period === 'annual' ? 'ANNUAL' : 'TERM';
  return `${prefix}_${aud}_${cadence}`;
}
