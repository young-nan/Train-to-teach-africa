/**
 * =============================================================================
 *  src/config/pricing.js
 *  THE single source of truth for all pricing across the platform.
 * =============================================================================
 *
 *  Brief (Part 1) requires that NO pricing values be hardcoded anywhere else
 *  in the codebase. Marketing pages, the checkout flow, the admin billing
 *  surface, and the Paystack edge function all read from this file.
 *
 *  Anything that needs a price imports `PLANS` and `formatPrice`.
 *
 *  When prices change:
 *    1. Update the cents/kobo values below.
 *    2. Update the FX benchmark in .env (VITE_FX_NGN_PER_USD).
 *    3. Add a migration row to `pricing_history` (see migrations).
 *
 *  RULE: All money is stored in *minor units* (kobo for NGN, cents for USD).
 *        We never use floats for currency arithmetic. JavaScript floats lose
 *        precision past ~15 digits and would silently misbill at scale.
 * =============================================================================
 */

const FX_NGN_PER_USD = Number(import.meta.env.VITE_FX_NGN_PER_USD ?? 1370.26);
const FX_DATE = import.meta.env.VITE_FX_BENCHMARK_DATE ?? '2026-05-05';

/**
 * Plan catalogue. Keys are stable plan codes used as foreign keys in
 * `subscriptions.plan_code`. Never rename a key — only deprecate.
 *
 * Pricing comes directly from the brief (Part 1 — Pricing Implementation).
 * African curriculum prices are FIXED in NGN; USD shown is informational only.
 * International curriculum prices are FIXED in USD.
 */
export const PLANS = Object.freeze({
  // ---- AFRICAN CURRICULUM (NGN-denominated) -------------------------------
  AFR_PARENT_TERM: {
    code: 'AFR_PARENT_TERM',
    track: 'african',
    audience: 'parent',
    cadence: 'term',
    currency: 'NGN',
    amountMinor: 1224000, // ₦12,240.00
    label: 'Parent · Per Term',
  },
  AFR_PARENT_ANNUAL: {
    code: 'AFR_PARENT_ANNUAL',
    track: 'african',
    audience: 'parent',
    cadence: 'annual',
    currency: 'NGN',
    amountMinor: 3572000, // ₦35,720.00
    label: 'Parent · Annual',
    saveHint: 'Save vs 3× term',
  },
  AFR_TEACHER_TERM: {
    code: 'AFR_TEACHER_TERM',
    track: 'african',
    audience: 'teacher',
    cadence: 'term',
    currency: 'NGN',
    amountMinor: 1468800, // ₦14,688.00
    label: 'Teacher · Per Term',
  },
  AFR_SCHOOL_TERM: {
    code: 'AFR_SCHOOL_TERM',
    track: 'african',
    audience: 'school',
    cadence: 'term',
    currency: 'NGN',
    amountMinor: 7865700, // ₦78,657.00
    label: 'School Bundle · Per Term',
  },
  AFR_SCHOOL_ANNUAL: {
    code: 'AFR_SCHOOL_ANNUAL',
    track: 'african',
    audience: 'school',
    cadence: 'annual',
    currency: 'NGN',
    amountMinor: 23297100, // ₦232,971.00
    label: 'School Bundle · Annual',
    saveHint: 'Save vs 3× term',
  },

  // ---- INTERNATIONAL CURRICULUM (USD-denominated) -------------------------
  INT_PARENT_TERM: {
    code: 'INT_PARENT_TERM',
    track: 'international',
    audience: 'parent',
    cadence: 'term',
    currency: 'USD',
    amountMinor: 1878, // $18.78
    label: 'Parent · Per Term',
  },
  INT_PARENT_ANNUAL: {
    code: 'INT_PARENT_ANNUAL',
    track: 'international',
    audience: 'parent',
    cadence: 'annual',
    currency: 'USD',
    amountMinor: 5534, // $55.34
    label: 'Parent · Annual',
    saveHint: 'Save vs 3× term',
  },
  INT_TEACHER_TERM: {
    code: 'INT_TEACHER_TERM',
    track: 'international',
    audience: 'teacher',
    cadence: 'term',
    currency: 'USD',
    amountMinor: 2178, // $21.78
    label: 'Teacher · Per Term',
  },
  INT_SCHOOL_TERM: {
    code: 'INT_SCHOOL_TERM',
    track: 'international',
    audience: 'school',
    cadence: 'term',
    currency: 'USD',
    amountMinor: 12932, // $129.32
    label: 'School Bundle · Per Term',
  },
  INT_SCHOOL_ANNUAL: {
    code: 'INT_SCHOOL_ANNUAL',
    track: 'international',
    audience: 'school',
    cadence: 'annual',
    currency: 'USD',
    amountMinor: 35096, // $350.96
    label: 'School Bundle · Annual',
    saveHint: 'Save vs 3× term',
  },
});

export const FX = Object.freeze({
  ngnPerUsd: FX_NGN_PER_USD,
  date: FX_DATE,
  disclaimer:
    `Exchange-based USD equivalents are estimates calculated using the ` +
    `${formatBenchmarkDate(FX_DATE)} benchmark rate of $1 ≈ ₦${FX_NGN_PER_USD.toFixed(2)}. ` +
    `African curriculum billing remains fixed in NGN.`,
});

/**
 * Format a price for display. Returns the canonical price string in the
 * plan's denominated currency.
 *
 * @param {keyof typeof PLANS | object} planOrCode
 * @returns {string} e.g. "₦12,240" or "$18.78"
 */
export function formatPrice(planOrCode) {
  const plan = typeof planOrCode === 'string' ? PLANS[planOrCode] : planOrCode;
  if (!plan) throw new Error(`Unknown plan: ${planOrCode}`);
  const major = plan.amountMinor / 100;
  if (plan.currency === 'NGN') {
    return `₦${major.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
  }
  // USD — drop trailing .00 for whole-dollar prices; show 2 dp otherwise.
  const formatted = major.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `$${formatted}`;
}

/**
 * For African plans, return the USD-equivalent shown beneath the NGN price.
 * Returns null for international plans (they don't need it).
 */
export function formatUsdEquivalent(planOrCode) {
  const plan = typeof planOrCode === 'string' ? PLANS[planOrCode] : planOrCode;
  if (!plan || plan.currency !== 'NGN') return null;
  const usdMajor = plan.amountMinor / 100 / FX_NGN_PER_USD;
  return `$${usdMajor.toFixed(2)}`;
}

/**
 * Filter helper — used by the public pricing page to render the right cards
 * after the African / International toggle is flipped.
 */
export function plansFor({ track, audience, cadence }) {
  return Object.values(PLANS).filter((p) => {
    if (track && p.track !== track) return false;
    if (audience && p.audience !== audience) return false;
    if (cadence && p.cadence !== cadence) return false;
    return true;
  });
}

function formatBenchmarkDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}
