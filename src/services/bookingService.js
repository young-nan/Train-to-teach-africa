/**
 * src/services/bookingService.js
 *
 * Parent-side marketplace operations: search, book, pay, review, cancel.
 *
 * BOOKING LIFECYCLE
 * ─────────────────
 *
 *   1. searchTutors()           → parent finds a tutor
 *   2. createBooking()          → bookings row created (status: pending_payment)
 *   3. initiateBookingPayment() → calls tutor-booking-payment edge function
 *                                 → returns authorization_url
 *   4. Parent pays on Paystack
 *   5. Webhook fires            → booking status → 'paid'
 *   6. confirmBooking()         → tutor accepts (status: confirmed)  [tutorService]
 *   7. Session happens
 *   8. confirm-session edge fn  → calls confirm_session_complete RPC
 *                                 → status: completed, payout_ledger row written
 *   9. submitReview()           → parent leaves rating (72-hour window)
 *
 * COMMISSION MODEL
 * ────────────────
 * TTA takes 15% of every booking. This is computed at booking-creation time
 * (not payout time) so the numbers are locked in — tutor cannot change their
 * rate after a booking is placed and affect the payout split.
 *
 * total_minor         = agreed_rate_minor × (duration_minutes / 60)
 * commission_minor    = round(total_minor × 0.15)
 * tutor_payout_minor  = total_minor − commission_minor
 */

import { supabase } from '@/lib/supabase';
import { logAuditEvent } from './auditService';

const COMMISSION_PCT = 15.00;

// ── Search ───────────────────────────────────────────────────────────────────

/**
 * Filtered, paginated tutor search. Calls the search_tutors RPC (migration
 * 0005 Part 8) which runs a single optimised query with window-function
 * pagination — no N+1 round trips.
 *
 * @param {{
 *   subject?:    string,
 *   curriculum?: string,
 *   city?:       string,
 *   mode?:       'online'|'offline',
 *   maxRate?:    number,   // hourly_rate_minor ceiling
 *   page?:       number,   // 1-indexed
 *   pageSize?:   number,
 * }} filters
 */
export async function searchTutors({
  subject    = null,
  curriculum = null,
  city       = null,
  mode       = null,
  maxRate    = null,
  page       = 1,
  pageSize   = 12,
} = {}) {
  const offset = (page - 1) * pageSize;

  const { data, error } = await supabase.rpc('search_tutors', {
    p_subject:    subject,
    p_curriculum: curriculum,
    p_city:       city,
    p_mode:       mode,
    p_max_rate:   maxRate,
    p_limit:      pageSize,
    p_offset:     offset,
  });

  if (error) throw new Error(`Search failed: ${error.message}`);

  const rows       = data ?? [];
  const totalCount = rows[0]?.total_count ?? 0;

  return {
    tutors:     rows,
    totalCount: Number(totalCount),
    page,
    pageSize,
    totalPages: Math.ceil(Number(totalCount) / pageSize),
  };
}

// ── Booking creation ─────────────────────────────────────────────────────────

/**
 * Create a pending_payment booking row. This is written BEFORE payment so
 * the tutor-booking-payment edge function has a booking_id to attach to the
 * Paystack transaction metadata.
 *
 * @param {{
 *   tutorId:         string,
 *   subject:         string,
 *   curriculum?:     string,
 *   sessionType:     'online'|'offline',
 *   sessionDate:     string,   // ISO date YYYY-MM-DD
 *   startTime:       string,   // HH:MM
 *   durationMinutes: 60|90|120,
 *   notesForTutor?:  string,
 *   agreedRateMinor: number,   // snapshot of tutor's hourly rate at booking time
 *   currency?:       string,
 * }} params
 */
export async function createBooking({
  tutorId,
  subject,
  curriculum    = null,
  sessionType,
  sessionDate,
  startTime,
  durationMinutes = 60,
  notesForTutor   = null,
  agreedRateMinor,
  currency        = 'NGN',
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Sign in before booking a session.');

  // Compute the split at booking time — locked in regardless of future rate changes.
  const totalMinor      = Math.round(agreedRateMinor * (durationMinutes / 60));
  const commissionMinor = Math.round(totalMinor * COMMISSION_PCT / 100);
  const payoutMinor     = totalMinor - commissionMinor;

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      parent_user_id:      user.id,
      tutor_id:            tutorId,
      subject,
      curriculum,
      session_type:        sessionType,
      session_date:        sessionDate,
      start_time:          startTime,
      duration_minutes:    durationMinutes,
      notes_for_tutor:     notesForTutor,
      agreed_rate_minor:   agreedRateMinor,
      total_minor:         totalMinor,
      currency,
      commission_pct:      COMMISSION_PCT,
      commission_minor:    commissionMinor,
      tutor_payout_minor:  payoutMinor,
      status:              'pending_payment',
    })
    .select()
    .single();

  if (error) throw new Error(`Could not create booking: ${error.message}`);

  logAuditEvent({
    action: 'booking.created',
    details: {
      booking_id:   data.id,
      tutor_id:     tutorId,
      total_minor:  totalMinor,
      session_date: sessionDate,
    },
  });

  return data;
}

// ── Payment ──────────────────────────────────────────────────────────────────

/**
 * Initiate payment for an existing pending_payment booking.
 * Calls the tutor-booking-payment edge function which:
 *   1. Validates the booking belongs to the caller
 *   2. Creates a Paystack transaction for booking.total_minor
 *   3. Returns authorization_url
 *
 * Caller redirects browser to authorization_url.
 * Webhook fires → booking status → 'paid'.
 */
export async function initiateBookingPayment({ bookingId, customerEmail }) {
  const { data, error } = await supabase.functions.invoke('tutor-booking-payment', {
    body: { booking_id: bookingId, email: customerEmail },
  });

  if (error || data?.error) {
    throw new Error(error?.message ?? data?.error ?? 'Could not start payment.');
  }

  return data; // { reference, authorization_url }
}

// ── Parent booking management ────────────────────────────────────────────────

/**
 * Parent's full booking history (all statuses), newest first.
 */
export async function listMyBookings({ status } = {}) {
  let q = supabase
    .from('bookings')
    .select(`
      *,
      tutors(id, full_name, photo_url, city, rating_avg)
    `)
    .order('session_date', { ascending: false });

  if (status) q = q.eq('status', status);

  const { data, error } = await q;
  if (error) throw new Error(`Could not load bookings: ${error.message}`);
  return data ?? [];
}

/**
 * Parent cancels a booking. Only allowed when status is pending_payment or paid.
 * Refund logic is handled separately by admin (or a future automated flow).
 */
export async function cancelBooking({ bookingId, reason }) {
  const { data, error } = await supabase
    .from('bookings')
    .update({
      status:       'cancelled',
      cancelled_at: new Date().toISOString(),
      cancel_reason: reason ?? null,
      updated_at:   new Date().toISOString(),
    })
    .eq('id', bookingId)
    .in('status', ['pending_payment', 'paid']) // RLS also enforces this
    .select()
    .single();

  if (error) throw new Error(`Could not cancel booking: ${error.message}`);
  logAuditEvent({ action: 'booking.cancelled_by_parent', details: { booking_id: bookingId } });
  return data;
}

// ── Reviews ──────────────────────────────────────────────────────────────────

/**
 * Submit a review for a completed session.
 * DB enforces: booking must be completed + within 72 hours + belong to caller.
 */
export async function submitReview({ bookingId, tutorId, rating, comment, isPublic = true }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Sign in to leave a review.');

  if (rating < 1 || rating > 5) throw new Error('Rating must be between 1 and 5.');

  const { data, error } = await supabase
    .from('booking_reviews')
    .insert({
      booking_id:  bookingId,
      reviewer_id: user.id,
      tutor_id:    tutorId,
      rating,
      comment:     comment ?? null,
      is_public:   isPublic,
    })
    .select()
    .single();

  if (error) {
    // Unique constraint violation = already reviewed.
    if (error.code === '23505') throw new Error('You have already reviewed this session.');
    throw new Error(`Could not submit review: ${error.message}`);
  }

  logAuditEvent({
    action: 'booking.reviewed',
    details: { booking_id: bookingId, tutor_id: tutorId, rating },
  });

  return data;
}

/**
 * Check if the parent can still review a specific booking.
 * Returns { canReview, hoursRemaining } — used to show/hide the review UI.
 */
export async function getReviewEligibility(bookingId) {
  const { data, error } = await supabase
    .from('bookings')
    .select('status, completed_at, booking_reviews(id)')
    .eq('id', bookingId)
    .single();

  if (error) return { canReview: false };

  const alreadyReviewed = (data.booking_reviews?.length ?? 0) > 0;
  if (alreadyReviewed) return { canReview: false, reason: 'already_reviewed' };
  if (data.status !== 'completed') return { canReview: false, reason: 'not_completed' };

  const completedAt    = new Date(data.completed_at);
  const windowClosesAt = new Date(completedAt.getTime() + 72 * 60 * 60 * 1000);
  const now            = new Date();

  if (now > windowClosesAt) return { canReview: false, reason: 'window_expired' };

  const hoursRemaining = Math.floor((windowClosesAt - now) / (1000 * 60 * 60));
  return { canReview: true, hoursRemaining };
}
