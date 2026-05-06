/**
 * src/services/simsService.js
 *
 * School Information Management System operations:
 *   - Attendance (the most-called write surface in the entire platform)
 *   - Scores (assessments + custom score entries)
 *   - Reports (term reports, class summaries)
 *   - Analytics (school-level aggregates for the admin dashboard)
 *
 * All write operations are designed to be safely retryable. Every record
 * carries a client-generated `idempotency_key` so the offline sync queue
 * can replay without creating duplicates.
 */

import { supabase } from '@/lib/supabase';

// ---- Attendance -----------------------------------------------------------

/**
 * Mark attendance for a class. Accepts an array of pupil records:
 *   [{ pupilId, status: 'present'|'absent'|'late', note? }, ...]
 *
 * The full batch is upserted in one call — failure on any row fails the
 * whole batch (atomic), so the teacher never sees partial state.
 */
export async function markAttendanceBatch({ classId, date, records, idempotencyKey }) {
  const rows = records.map((r) => ({
    class_id: classId,
    pupil_id: r.pupilId,
    date,
    status: r.status,
    note: r.note ?? null,
    idempotency_key: idempotencyKey,
  }));

  const { data, error } = await supabase
    .from('attendance')
    .upsert(rows, { onConflict: 'class_id,pupil_id,date' })
    .select();
  if (error) throw new Error(`Could not save attendance: ${error.message}`);
  return data;
}

export async function getAttendanceForClass({ classId, date }) {
  const { data, error } = await supabase
    .from('attendance')
    .select('pupil_id, status, note')
    .eq('class_id', classId)
    .eq('date', date);
  if (error) throw new Error(`Could not load attendance: ${error.message}`);
  return data ?? [];
}

// ---- Scores ---------------------------------------------------------------

export async function enterScores({ classId, assessmentId, scores, idempotencyKey }) {
  const rows = scores.map((s) => ({
    class_id: classId,
    assessment_id: assessmentId,
    pupil_id: s.pupilId,
    score: s.score,
    max_score: s.maxScore,
    idempotency_key: idempotencyKey,
  }));
  const { data, error } = await supabase
    .from('scores')
    .upsert(rows, { onConflict: 'assessment_id,pupil_id' })
    .select();
  if (error) throw new Error(`Could not save scores: ${error.message}`);
  return data;
}

// ---- Reports --------------------------------------------------------------

/**
 * Generate a term report for a pupil. Server-side aggregation — we never
 * compute report grades client-side. Returns a signed URL to a rendered PDF.
 */
export async function generateTermReport({ pupilId, term, year }) {
  const { data, error } = await supabase.functions.invoke('generate-report', {
    body: { pupil_id: pupilId, term, year },
  });
  if (error) throw new Error(`Could not generate report: ${error.message}`);
  return data; // { report_id, url, expires_at }
}

// ---- Analytics ------------------------------------------------------------

/**
 * KPIs for the admin dashboard hero band. Reads from a materialised view
 * that's refreshed every 5 minutes (see migrations).
 */
export async function getSchoolKpis(schoolId) {
  const { data, error } = await supabase
    .from('school_kpis_v')
    .select('*')
    .eq('school_id', schoolId)
    .single();
  if (error) throw new Error(`Could not load KPIs: ${error.message}`);
  return data;
}

export async function getAttendanceTrend({ schoolId, days = 14 }) {
  const { data, error } = await supabase.rpc('attendance_trend', {
    p_school_id: schoolId,
    p_days: days,
  });
  if (error) throw new Error(`Could not load trend: ${error.message}`);
  return data;
}

// ---- Class + pupil reads --------------------------------------------------

/**
 * Returns the classes the calling teacher teaches. By default scopes to
 * the authenticated user — a teacher never has to pass their own ID.
 * Admins can pass an explicit teacherId to fetch another teacher's load.
 */
export async function getMyClasses(teacherId) {
  let query = supabase
    .from('classes')
    .select('id, name, level, pupil_count, school_id')
    .order('name');

  if (teacherId) {
    query = query.eq('teacher_id', teacherId);
  } else {
    // Resolve current user. RLS will additionally enforce school scope,
    // but the explicit filter helps Postgres pick the right index.
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) throw new Error('Not signed in');
    query = query.eq('teacher_id', user.id);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Could not load classes: ${error.message}`);
  return data ?? [];
}

export async function getPupilsInClass(classId) {
  const { data, error } = await supabase
    .from('pupils')
    .select('id, full_name, photo_url, pupil_code')
    .eq('class_id', classId)
    .order('full_name');
  if (error) throw new Error(`Could not load pupils: ${error.message}`);
  return data ?? [];
}
