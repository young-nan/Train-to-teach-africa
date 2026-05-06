/**
 * src/utils/greeting.js
 *
 * Returns "Good morning" / "Good afternoon" / "Good evening" based on
 * the user's local time, not UTC.
 *
 * Why this is a utility, not a one-liner where it's used:
 *   - The boundaries (5am, 12pm, 5pm) are opinions, not facts. Centralising
 *     them means the school admin can change "evening starts at 17:00" once,
 *     not in seven greeting components.
 *   - Tested. The current Today view's greeting could say "Good morning" at
 *     11pm if a teacher's device is set to UTC and they live in Lagos —
 *     because new Date().getHours() returns UTC hours, not local hours.
 *     Surprisingly common bug.
 *
 * The hour is always read from the user's device locale via Date.getHours(),
 * which respects the device timezone. If a teacher's device is misconfigured,
 * the greeting will be wrong, but that's the teacher's problem to notice —
 * we can't override their timezone.
 */

const BOUNDARIES = {
  morningStart: 5,   // 05:00
  afternoonStart: 12, // 12:00
  eveningStart: 17,   // 17:00
  // 00:00–04:59 also returns "evening" — late-night work happens.
};

/**
 * @param {Date} [now] — for testing only; defaults to the current time
 * @returns {'Good morning' | 'Good afternoon' | 'Good evening'}
 */
export function getGreeting(now = new Date()) {
  const hour = now.getHours();
  if (hour >= BOUNDARIES.morningStart && hour < BOUNDARIES.afternoonStart) {
    return 'Good morning';
  }
  if (hour >= BOUNDARIES.afternoonStart && hour < BOUNDARIES.eveningStart) {
    return 'Good afternoon';
  }
  return 'Good evening';
}
