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
import { logAuditEvent } from './auditService';

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

  // Aggregate counts go into the audit detail. Lets admins answer "how
  // many absences were marked across the school today" with one query.
  const counts = rows.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  logAuditEvent({
    action: 'attendance.marked',
    details: {
      class_id: classId,
      date,
      total: rows.length,
      counts,
      idempotency_key: idempotencyKey,
    },
  });

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

// ---- Gradebook · assessments + terms --------------------------------------

/**
 * List assessments for the teacher's classes within the current term.
 * Used by the gradebook list screen.
 */
export async function listAssessmentsForTeacher({ termId } = {}) {
  let query = supabase
    .from('assessments')
    .select(`
      id, title, subject, max_score, given_on,
      class_id, term_id, component_id,
      classes!inner(id, name, level, teacher_id),
      term_components(id, code, label, weight)
    `)
    .order('given_on', { ascending: false });

  if (termId) query = query.eq('term_id', termId);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) throw new Error('Not signed in');
  query = query.eq('classes.teacher_id', user.id);

  const { data, error } = await query;
  if (error) throw new Error(`Could not load assessments: ${error.message}`);
  return data ?? [];
}

export async function getAssessment(assessmentId) {
  const { data, error } = await supabase
    .from('assessments')
    .select(`
      *, classes(id, name, level, school_id),
      term_components(id, code, label, weight),
      terms(id, name, academic_year, term_number)
    `)
    .eq('id', assessmentId)
    .single();
  if (error) throw new Error(`Could not load assessment: ${error.message}`);
  return data;
}

export async function createAssessment({ classId, termId, componentId, title, subject, maxScore, givenOn }) {
  const { data, error } = await supabase
    .from('assessments')
    .insert({
      class_id: classId,
      term_id: termId,
      component_id: componentId,
      title,
      subject,
      max_score: maxScore,
      given_on: givenOn ?? new Date().toISOString().slice(0, 10),
    })
    .select()
    .single();
  if (error) throw new Error(`Could not create assessment: ${error.message}`);
  return data;
}

/**
 * Get scores already entered for an assessment. Used to hydrate the
 * gradebook entry screen so a teacher returning later sees their work.
 */
export async function getScoresForAssessment(assessmentId) {
  const { data, error } = await supabase
    .from('scores')
    .select('pupil_id, score, max_score')
    .eq('assessment_id', assessmentId);
  if (error) throw new Error(`Could not load scores: ${error.message}`);
  return data ?? [];
}

// ---- Terms + term components ----------------------------------------------

export async function listTermsForSchool(schoolId) {
  const { data, error } = await supabase
    .from('terms')
    .select(`
      id, academic_year, term_number, name, starts_on, ends_on, is_current,
      term_components(id, code, label, weight, sort_index)
    `)
    .eq('school_id', schoolId)
    .order('starts_on', { ascending: false });
  if (error) throw new Error(`Could not load terms: ${error.message}`);
  return data ?? [];
}

export async function getCurrentTerm(schoolId) {
  const { data, error } = await supabase
    .from('terms')
    .select(`
      id, name, academic_year, term_number, starts_on, ends_on,
      term_components(id, code, label, weight, sort_index)
    `)
    .eq('school_id', schoolId)
    .eq('is_current', true)
    .maybeSingle();
  if (error) throw new Error(`Could not load current term: ${error.message}`);
  return data;
}

// ---- Reports --------------------------------------------------------------

/**
 * Generate a term report for a pupil. Server-side aggregation — we never
 * compute report grades client-side. Returns a signed URL to a rendered PDF.
 */
export async function generateTermReport({ pupilId, termId }) {
  const { data, error } = await supabase.functions.invoke('generate-report', {
    body: { pupil_id: pupilId, term_id: termId },
  });
  if (error) throw new Error(`Could not generate report: ${error.message}`);
  return data; // { report_id, url, expires_at }
}

/**
 * Fetch the structured report data for a pupil. Used to preview a report
 * before triggering PDF generation, AND used by the edge function as the
 * data source for rendering. One source of truth.
 */
export async function getTermReportData({ pupilId, termId }) {
  const { data, error } = await supabase.rpc('term_report_for_pupil', {
    p_pupil_id: pupilId,
    p_term_id: termId,
  });
  if (error) throw new Error(`Could not load report data: ${error.message}`);
  return data;
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
/**
 * Returns classes the calling user teaches. With the v0009 migration, a
 * teacher can be assigned to many classes via `class_teachers`. The RPC
 * unions the legacy `classes.teacher_id` with the new join table so
 * existing single-teacher classes still appear.
 *
 * Falls back to the legacy single-teacher query if the RPC isn't present
 * — protects against migration drift bricking the gradebook.
 */
export async function getMyClasses() {
  const rpc = await supabase.rpc('my_taught_classes');
  if (!rpc.error) return rpc.data ?? [];

  // RPC missing (migration not applied) → fall back to legacy column.
  // The PostgREST error code for "function not found" is PGRST202.
  const isMissingFn = rpc.error.code === 'PGRST202'
    || /Could not find the function/i.test(rpc.error.message ?? '');
  if (!isMissingFn) {
    throw new Error(`Could not load classes: ${rpc.error.message}`);
  }

  console.warn('[sims] my_taught_classes RPC missing, using legacy query');
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) throw new Error('Not signed in');
  const { data, error } = await supabase
    .from('classes')
    .select('id, name, level, pupil_count, school_id')
    .eq('teacher_id', user.id)
    .order('name');
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

/**
 * Returns the calling parent's children. Resolved server-side via the
 * parent_pupil_links table — RLS scopes the lookup to the authenticated
 * user, so this works without passing the parent's user_id.
 *
 * Used by the parent app to list children and pick whose reports to view.
 */
export async function getMyChildren() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) throw new Error('Not signed in');

  // Two-step: get pupil_ids from links, then hydrate pupil rows.
  // Done as a single .select() with embedded join would be ideal, but
  // PostgREST's syntax for join-then-filter is fragile — explicit beats
  // implicit.
  const { data: links, error: lerr } = await supabase
    .from('parent_pupil_links')
    .select('pupil_id')
    .eq('parent_user_id', user.id);
  if (lerr) throw new Error(`Could not load children: ${lerr.message}`);
  if (!links?.length) return [];

  const pupilIds = links.map((l) => l.pupil_id);
  const { data: pupils, error: perr } = await supabase
    .from('pupils')
    .select('id, full_name, photo_url, pupil_code, level, class_id, classes(name, level)')
    .in('id', pupilIds)
    .order('full_name');
  if (perr) throw new Error(`Could not load children: ${perr.message}`);
  return pupils ?? [];
}


// =============================================================================
// Attendance export
// =============================================================================

/**
 * Fetch all attendance records for a class within a date range.
 * Returns rows joined to pupil names so the CSV is human-readable.
 *
 * Used by the teacher attendance export feature.
 */
export async function getAttendanceRange({ classId, fromDate, toDate }) {
  const { data, error } = await supabase
    .from('attendance')
    .select('date, status, note, pupil_id, pupils(full_name, pupil_code)')
    .eq('class_id', classId)
    .gte('date', fromDate)
    .lte('date', toDate)
    .order('date', { ascending: true })
    .order('pupils(full_name)', { ascending: true });

  if (error) throw new Error(`Could not load attendance: ${error.message}`);
  return data ?? [];
}
