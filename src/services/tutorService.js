/**
 * src/services/tutorService.js
 *
 * All tutor-side marketplace operations: profile creation, guarantor
 * submission, subject management, availability, and admin approval.
 *
 * Parent-side search lives in bookingService.js (search + book are one flow).
 *
 * DATA FLOW
 * ─────────
 * Tutor signs up (auth.users row created)
 *   → createTutorProfile()           writes tutors row (status: pending)
 *   → upsertSubjects()               writes tutor_subjects rows
 *   → upsertAvailability()           writes tutor_availability rows
 *   → submitGuarantor()              writes guarantors row (offline tutors)
 * Admin reviews → approveTutor() / rejectTutor()
 *   → profile goes live, parent search returns it
 */

import { supabase } from '@/lib/supabase';
import { logAuditEvent } from './auditService';

// ── Tutor profile ────────────────────────────────────────────────────────────

/**
 * Create the tutor's initial profile during onboarding.
 * A user can only have one tutor profile (unique user_id constraint in DB).
 */
export async function createTutorProfile({
  fullName,
  bio,
  city,
  state,
  highestQualification,
  yearsExperience,
  ncceRegistered = false,
  teachesOnline = true,
  teachesOffline = false,
  hourlyRateMinor,
  currency = 'NGN',
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Sign in before creating a tutor profile.');

  const { data, error } = await supabase
    .from('tutors')
    .insert({
      user_id:               user.id,
      full_name:             fullName,
      bio,
      city,
      state,
      highest_qualification: highestQualification,
      years_experience:      yearsExperience ?? 0,
      ncce_registered:       ncceRegistered,
      teaches_online:        teachesOnline,
      teaches_offline:       teachesOffline,
      hourly_rate_minor:     hourlyRateMinor,
      currency,
    })
    .select()
    .single();

  if (error) throw new Error(`Could not create tutor profile: ${error.message}`);

  logAuditEvent({ action: 'tutor.profile_created', details: { tutor_id: data.id } });
  return data;
}

/**
 * Update the tutor's own profile. Only non-identity fields are accepted.
 * approval_status cannot be changed by the tutor (enforced by RLS policy
 * + this whitelist — two independent layers).
 */
export async function updateMyTutorProfile(patch) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated.');

  const allowed = {};
  for (const k of [
    'full_name', 'bio', 'photo_url', 'city', 'state',
    'highest_qualification', 'years_experience', 'ncce_registered',
    'teaches_online', 'teaches_offline', 'hourly_rate_minor', 'currency',
  ]) {
    if (k in patch) allowed[k] = patch[k];
  }

  const { data, error } = await supabase
    .from('tutors')
    .update({ ...allowed, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) throw new Error(`Could not update profile: ${error.message}`);
  logAuditEvent({ action: 'tutor.profile_updated', details: { changes: Object.keys(allowed) } });
  return data;
}

/**
 * Get the current user's tutor profile. Returns null if they haven't
 * created one yet (i.e. they're mid-onboarding).
 */
export async function getMyTutorProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('tutors')
    .select(`
      *,
      tutor_subjects(*),
      tutor_availability(*),
      guarantors(*)
    `)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw new Error(`Could not load tutor profile: ${error.message}`);
  return data;
}

/**
 * Get a public tutor profile by ID. Returns only publicly visible fields.
 * Used by the parent booking flow and public tutor detail page.
 */
export async function getTutorProfile(tutorId) {
  const { data, error } = await supabase
    .from('tutors')
    .select(`
      id, full_name, photo_url, bio, city, state,
      years_experience, ncce_registered,
      teaches_online, teaches_offline,
      hourly_rate_minor, currency,
      rating_avg, rating_count,
      tutor_subjects(subject, curriculum, level),
      tutor_availability(day_of_week, start_time, end_time, mode),
      booking_reviews(rating, comment, created_at)
    `)
    .eq('id', tutorId)
    .eq('approval_status', 'approved')
    .single();

  if (error) throw new Error(`Could not load tutor: ${error.message}`);
  return data;
}

// ── Subjects ─────────────────────────────────────────────────────────────────

/**
 * Replace the tutor's subject list entirely. Caller passes the full desired
 * list; we delete-then-insert so the UI doesn't need to track which rows
 * were added vs removed.
 *
 * @param {Array<{subject, curriculum, level?}>} subjects
 */
export async function upsertSubjects(subjects) {
  const profile = await getMyTutorProfile();
  if (!profile) throw new Error('Create a tutor profile first.');

  if (!Array.isArray(subjects) || subjects.length === 0) {
    throw new Error('At least one subject is required.');
  }

  // Delete existing then insert fresh — simpler than diffing.
  const { error: delErr } = await supabase
    .from('tutor_subjects')
    .delete()
    .eq('tutor_id', profile.id);

  if (delErr) throw new Error(`Could not clear subjects: ${delErr.message}`);

  const rows = subjects.map((s) => ({
    tutor_id:   profile.id,
    subject:    s.subject,
    curriculum: s.curriculum,
    level:      s.level ?? null,
  }));

  const { data, error } = await supabase
    .from('tutor_subjects')
    .insert(rows)
    .select();

  if (error) throw new Error(`Could not save subjects: ${error.message}`);
  return data;
}

// ── Availability ──────────────────────────────────────────────────────────────

/**
 * Replace the tutor's weekly availability. Same delete-then-insert pattern
 * as upsertSubjects for the same reasons.
 *
 * @param {Array<{dayOfWeek, startTime, endTime, mode}>} slots
 */
export async function upsertAvailability(slots) {
  const profile = await getMyTutorProfile();
  if (!profile) throw new Error('Create a tutor profile first.');

  const { error: delErr } = await supabase
    .from('tutor_availability')
    .delete()
    .eq('tutor_id', profile.id);

  if (delErr) throw new Error(`Could not clear availability: ${delErr.message}`);

  if (!slots || slots.length === 0) return [];

  const rows = slots.map((s) => ({
    tutor_id:    profile.id,
    day_of_week: s.dayOfWeek,
    start_time:  s.startTime,
    end_time:    s.endTime,
    mode:        s.mode ?? 'both',
  }));

  const { data, error } = await supabase
    .from('tutor_availability')
    .insert(rows)
    .select();

  if (error) throw new Error(`Could not save availability: ${error.message}`);
  return data;
}

// ── Guarantor ─────────────────────────────────────────────────────────────────

/**
 * Submit a guarantor. Required for offline (in-person) tutors before
 * admin will approve teaches_offline = true.
 * One guarantor per tutor (unique constraint in DB).
 */
export async function submitGuarantor({ fullName, phone, relationship, address }) {
  const profile = await getMyTutorProfile();
  if (!profile) throw new Error('Create a tutor profile first.');

  const { data, error } = await supabase
    .from('guarantors')
    .upsert(
      {
        tutor_id:     profile.id,
        full_name:    fullName,
        phone,
        relationship,
        address:      address ?? null,
        // Reset verification on re-submission so admin re-verifies.
        verified:        false,
        verified_by:     null,
        verified_at:     null,
        verification_note: null,
      },
      { onConflict: 'tutor_id' },
    )
    .select()
    .single();

  if (error) throw new Error(`Could not submit guarantor: ${error.message}`);
  logAuditEvent({ action: 'tutor.guarantor_submitted', details: { tutor_id: profile.id } });
  return data;
}

// ── Admin operations ──────────────────────────────────────────────────────────

/**
 * Super admin: list all tutors pending review.
 */
export async function listPendingTutors() {
  const { data, error } = await supabase
    .from('tutors')
    .select(`*, tutor_subjects(*), guarantors(*)`)
    .eq('approval_status', 'pending')
    .order('created_at');

  if (error) throw new Error(`Could not load pending tutors: ${error.message}`);
  return data ?? [];
}

/**
 * Super admin: approve a tutor and optionally update their profile.
 * Also verifies the guarantor if one exists (admin can note the call outcome).
 */
export async function approveTutor({ tutorId, guarantorNote }) {
  const { data: { user } } = await supabase.auth.getUser();

  // Approve the tutor profile.
  const { data, error } = await supabase
    .from('tutors')
    .update({
      approval_status: 'approved',
      approved_by:     user.id,
      approved_at:     new Date().toISOString(),
      updated_at:      new Date().toISOString(),
    })
    .eq('id', tutorId)
    .select()
    .single();

  if (error) throw new Error(`Could not approve tutor: ${error.message}`);

  // If there's a guarantor and admin has verified them, mark it.
  if (guarantorNote) {
    await supabase
      .from('guarantors')
      .update({
        verified:          true,
        verified_by:       user.id,
        verified_at:       new Date().toISOString(),
        verification_note: guarantorNote,
      })
      .eq('tutor_id', tutorId);
  }

  logAuditEvent({
    action: 'tutor.approved',
    details: { tutor_id: tutorId, guarantor_verified: !!guarantorNote },
  });

  return data;
}

/**
 * Super admin: reject a tutor application.
 */
export async function rejectTutor({ tutorId, reason }) {
  if (!reason?.trim()) throw new Error('Rejection reason is required.');

  const { data, error } = await supabase
    .from('tutors')
    .update({
      approval_status:  'rejected',
      rejection_reason: reason,
      updated_at:       new Date().toISOString(),
    })
    .eq('id', tutorId)
    .select()
    .single();

  if (error) throw new Error(`Could not reject tutor: ${error.message}`);
  logAuditEvent({ action: 'tutor.rejected', details: { tutor_id: tutorId, reason } });
  return data;
}

// ── Tutor dashboard ───────────────────────────────────────────────────────────

/**
 * Tutor earnings summary by month. Used by /app/tutor/earnings.
 */
export async function getEarningsSummary() {
  const profile = await getMyTutorProfile();
  if (!profile) return [];

  const { data, error } = await supabase.rpc('tutor_earnings_summary', {
    p_tutor_id: profile.id,
  });

  if (error) throw new Error(`Could not load earnings: ${error.message}`);
  return data ?? [];
}

/**
 * Tutor's upcoming confirmed bookings. Used by /app/tutor/schedule.
 */
export async function getMyUpcomingBookings() {
  const profile = await getMyTutorProfile();
  if (!profile) return [];

  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('tutor_id', profile.id)
    .in('status', ['paid', 'confirmed'])
    .gte('session_date', new Date().toISOString().slice(0, 10))
    .order('session_date')
    .order('start_time');

  if (error) throw new Error(`Could not load bookings: ${error.message}`);
  return data ?? [];
}

/**
 * Tutor confirms they accept a booking (paid → confirmed).
 */
export async function confirmBooking(bookingId) {
  const { data, error } = await supabase
    .from('bookings')
    .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
    .eq('id', bookingId)
    .select()
    .single();

  if (error) throw new Error(`Could not confirm booking: ${error.message}`);
  logAuditEvent({ action: 'booking.tutor_confirmed', details: { booking_id: bookingId } });
  return data;
}
