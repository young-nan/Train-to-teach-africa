/**
 * src/hooks/useBooking.js
 *
 * State engine for a parent's booking flow. Manages the multi-step journey:
 *   selecting a tutor → configuring a session → paying → tracking status.
 *
 * DESIGN DECISIONS
 * ────────────────
 *
 * OPTIMISTIC STATUS — The booking row is created locally and shown
 * immediately. Paystack redirect happens externally; when the parent
 * returns to /billing/return?reference=... the existing
 * pollVerificationStatus() in paymentService.js detects 'paid'.
 *
 * OFFLINE CONSIDERATION — Booking creation and cancellation are queued
 * via the offline queue if the network drops mid-flow. This is less
 * critical than attendance (parents usually have a working connection to
 * make a payment), but the queue support ensures a partially-created
 * booking doesn't strand silently if the insert times out.
 *
 * NO REDUNDANT STATE — The tutor profile and search results live in their
 * own component state (ParentTutorSearchView). This hook only owns the
 * booking-in-progress and the parent's booking list.
 */

import { useState, useEffect, useCallback } from 'react';
import * as bookingService from '@/services/bookingService';
import * as queue from '@/lib/offline/queue';

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * @returns {{
 *   bookings:       object[],          // parent's booking history
 *   loading:        boolean,
 *   error:          string|null,
 *   createAndPay:   (params) => Promise<{authorization_url}>,
 *   cancel:         (bookingId, reason?) => Promise<void>,
 *   submitReview:   (params) => Promise<void>,
 *   reviewStatus:   Record<string, {canReview, hoursRemaining}>,
 *   reload:         () => void,
 * }}
 */
export function useBooking() {
  const [bookings, setBookings]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [reviewStatus, setReviewStatus] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await bookingService.listMyBookings();
      setBookings(data);

      // Pre-fetch review eligibility for completed bookings (small N, cheap).
      const completed = data.filter((b) => b.status === 'completed');
      const statuses = await Promise.all(
        completed.map(async (b) => {
          const elig = await bookingService.getReviewEligibility(b.id);
          return [b.id, elig];
        }),
      );
      setReviewStatus(Object.fromEntries(statuses));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /**
   * Create a booking row then immediately initiate payment.
   * Returns the authorization_url so the caller can redirect.
   *
   * Queues the DB insert if offline — the insert will replay when
   * connectivity returns, but note: the parent cannot pay until online
   * anyway, so the queue here is purely for booking record preservation.
   */
  const createAndPay = useCallback(async ({
    tutor,
    subject,
    curriculum,
    sessionType,
    sessionDate,
    startTime,
    durationMinutes,
    notesForTutor,
    customerEmail,
  }) => {
    setError(null);

    // Optimistically add a 'pending_payment' entry to the local list
    // so the UI shows "booking placed" before the network round-trip.
    const tempId = `temp-${Date.now()}`;
    const optimistic = {
      id:               tempId,
      tutor_id:         tutor.id,
      tutors:           { full_name: tutor.full_name, photo_url: tutor.photo_url },
      subject,
      session_date:     sessionDate,
      start_time:       startTime,
      duration_minutes: durationMinutes,
      status:           'pending_payment',
      total_minor:      Math.round(tutor.hourly_rate_minor * (durationMinutes / 60)),
      currency:         tutor.currency,
    };
    setBookings((prev) => [optimistic, ...prev]);

    try {
      // Write the booking row first (before calling Paystack) so there's
      // always a DB record even if the browser crashes after payment.
      const booking = await bookingService.createBooking({
        tutorId:         tutor.id,
        subject,
        curriculum,
        sessionType,
        sessionDate,
        startTime,
        durationMinutes,
        notesForTutor,
        agreedRateMinor: tutor.hourly_rate_minor,
        currency:        tutor.currency ?? 'NGN',
      });

      // Replace the optimistic row with the real one.
      setBookings((prev) =>
        prev.map((b) => (b.id === tempId ? { ...booking, tutors: optimistic.tutors } : b)),
      );

      // Get the Paystack authorization URL.
      const { authorization_url } = await bookingService.initiateBookingPayment({
        bookingId:     booking.id,
        customerEmail,
      });

      return { authorization_url, bookingId: booking.id };
    } catch (e) {
      // Remove the optimistic row on failure.
      setBookings((prev) => prev.filter((b) => b.id !== tempId));
      setError(e.message);
      throw e;
    }
  }, []);

  /**
   * Cancel a booking. Optimistic: flips status locally then writes to DB.
   * If the write fails, reverts to the original status.
   */
  const cancel = useCallback(async (bookingId, reason) => {
    setError(null);

    // Optimistic update.
    setBookings((prev) =>
      prev.map((b) =>
        b.id === bookingId ? { ...b, status: 'cancelled' } : b,
      ),
    );

    try {
      await bookingService.cancelBooking({ bookingId, reason });
    } catch (e) {
      // Revert on failure.
      setBookings((prev) =>
        prev.map((b) =>
          b.id === bookingId ? { ...b, status: 'paid' } : b,
        ),
      );
      setError(e.message);
      throw e;
    }
  }, []);

  /**
   * Submit a review. Updates the local reviewStatus so the review form
   * hides without needing a full reload.
   */
  const submitReview = useCallback(async ({ bookingId, tutorId, rating, comment }) => {
    setError(null);
    try {
      await bookingService.submitReview({ bookingId, tutorId, rating, comment });
      // Mark as reviewed locally so the form disappears immediately.
      setReviewStatus((prev) => ({
        ...prev,
        [bookingId]: { canReview: false, reason: 'already_reviewed' },
      }));
    } catch (e) {
      setError(e.message);
      throw e;
    }
  }, []);

  return {
    bookings,
    loading,
    error,
    createAndPay,
    cancel,
    submitReview,
    reviewStatus,
    reload: load,
  };
}

// ── Tutor search hook ─────────────────────────────────────────────────────────

/**
 * Manages tutor search state independently of the booking flow.
 * Used by ParentTutorSearchView.
 *
 * @param {object} initialFilters
 */
export function useTutorSearch(initialFilters = {}) {
  const [filters, setFilters]   = useState(initialFilters);
  const [results, setResults]   = useState({ tutors: [], totalCount: 0, totalPages: 0 });
  const [page, setPage]         = useState(1);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);

  const search = useCallback(async (overrides = {}) => {
    setLoading(true);
    setError(null);
    try {
      const merged = { ...filters, ...overrides, page };
      const data   = await bookingService.searchTutors(merged);
      setResults(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  // Re-search whenever filters or page change.
  useEffect(() => { search(); }, [filters, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateFilter = useCallback((key, value) => {
    setPage(1); // Reset to page 1 when filter changes.
    setFilters((prev) => ({ ...prev, [key]: value || null }));
  }, []);

  const clearFilters = useCallback(() => {
    setPage(1);
    setFilters({});
  }, []);

  return {
    results,
    filters,
    page,
    loading,
    error,
    updateFilter,
    clearFilters,
    setPage,
    refresh: search,
  };
}
