/**
 * src/config/pilotMode.js
 *
 * PILOT MODE — Temporary subscription bypass for the TTA pilot phase.
 *
 * PURPOSE
 * ───────
 * During the pilot with TLF Lekki and early partner schools, we want all
 * platform features accessible without requiring payment. This file provides
 * the central flag and helper utilities.
 *
 * WHAT IT DOES
 * ─────────────
 * When PILOT_MODE is active:
 *   ✓ All role dashboards are fully accessible
 *   ✓ All lesson content is accessible (no lesson paywall)
 *   ✓ All reports are accessible
 *   ✓ All tutor features are accessible
 *   ✗ No payment is required
 *
 * WHAT IT PRESERVES (never removed by pilot mode)
 * ─────────────────────────────────────────────────
 *   • Pricing architecture (PLANS in pricing.js)
 *   • Subscription plan records in subscriptions table
 *   • Billing tables and invoices
 *   • Payment workflows (Paystack integration)
 *   • Commission engine (10% tutor commission)
 *
 * CONTROL
 * ────────
 * SuperAdmin toggles via /app/super — writes to platform_settings table.
 * The value is hydrated at boot via platformService.getPilotMode().
 * Stored in Zustand so all components reactively update.
 *
 * LOCAL OVERRIDE (development only)
 * ───────────────────────────────────
 * Set VITE_PILOT_MODE=true in .env.local to force pilot mode in dev
 * without needing a database write.
 */

/** @type {boolean} Local env override — dev/staging only */
export const PILOT_MODE_ENV_OVERRIDE =
  import.meta.env.VITE_PILOT_MODE === 'true';

/**
 * The pilot mode banner text. Displayed across all surfaces when active.
 * SuperAdmin sees this with a toggle; all other roles see it as read-only.
 */
export const PILOT_BANNER_TEXT = 'Pilot Environment — All Features Enabled';

/**
 * Checks if a given feature gate should be bypassed due to pilot mode.
 *
 * @param {boolean}  pilotMode   - Current pilot mode state from the store.
 * @param {boolean}  hasAccess   - Whether the user would normally have access.
 * @returns {boolean}            - true = access granted.
 *
 * Usage:
 *   const allowed = checkAccess(pilotMode, subscription?.active);
 */
export function checkAccess(pilotMode, hasAccess) {
  if (pilotMode) return true;
  return Boolean(hasAccess);
}
