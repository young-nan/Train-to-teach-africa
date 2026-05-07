/**
 * src/services/reportsService.js
 *
 * Term reports: data + workflow.
 *
 * Workflow states:
 *   draft           — class teacher writing comments/conduct
 *   pending_approval — submitted to head teacher
 *   approved        — head teacher signed off; ready to publish
 *   published       — parent can see it
 *   archived        — past-academic-year, kept for history
 *
 * Schools with report_auto_publish=true skip pending_approval and approved
 * — draft → published directly. Set on the schools table by an admin.
 *
 * The PDF render is server-side (edge function `render-term-report`).
 * This service triggers the render and waits for the storage path to
 * appear; it does NOT generate the PDF itself.
 */

import { supabase } from '@/lib/supabase';
import { logAuditEvent } from './auditService';

// ---- List + fetch ---------------------------------------------------------

/**
 * Returns one row per pupil in a class, with the report status (or 'not_started').
 * Used by the teacher's reports list.
 */
export async function listClassReports({ classId, term, year }) {
  // Two queries because we want pupils WITHOUT reports to appear too.
  // Using the RPC would be a third option later if N+1 becomes a problem.
  const [pupilsRes, reportsRes] = await Promise.all([
    supabase
      .from('pupils')
      .select('id, full_name, pupil_code, photo_url, level')
      .eq('class_id', classId)
      .order('full_name'),
    supabase
      .from('term_reports')
      .select('*')
      .eq('class_id', classId)
      .eq('term', term)
      .eq('year', year),
  ]);

  if (pupilsRes.error) throw new Error(`Could not load pupils: ${pupilsRes.error.message}`);
  if (reportsRes.error) throw new Error(`Could not load reports: ${reportsRes.error.message}`);

  const reportsByPupil = new Map((reportsRes.data ?? []).map((r) => [r.pupil_id, r]));
  return (pupilsRes.data ?? []).map((p) => ({
    pupil: p,
    report: reportsByPupil.get(p.id) ?? null,
  }));
}

/**
 * Returns one report's worth of data — pupil bio, school header, all subject
 * grids, attendance, comments, conduct, and the report envelope. Used by
 * the comment-entry screen and the PDF renderer alike.
 */
export async function getReportData({ pupilId, term, year }) {
  const { data, error } = await supabase.rpc('report_data_for_pupil', {
    p_pupil_id: pupilId,
    p_term: term,
    p_year: year,
  });
  if (error) throw new Error(`Could not load report data: ${error.message}`);
  return data;
}

// ---- Comments + conduct (the things teachers fill in) ---------------------

export async function saveSubjectComment({ pupilId, classId, subject, term, year, comment, writtenBy }) {
  const { data, error } = await supabase
    .from('subject_comments')
    .upsert({
      pupil_id: pupilId,
      class_id: classId,
      subject,
      term,
      year,
      comment,
      written_by: writtenBy,
    }, { onConflict: 'pupil_id,subject,term,year' })
    .select()
    .single();
  if (error) throw new Error(`Could not save comment: ${error.message}`);

  logAuditEvent({
    action: 'report.subject_comment_saved',
    targetPupilId: pupilId,
    details: { subject, term, year },
  });

  // Invalidate any cached PDF — content changed.
  await invalidatePdf({ pupilId, term, year });

  return data;
}

export async function savePupilComment({ pupilId, term, year, comment, writtenBy }) {
  const { data, error } = await supabase
    .from('pupil_comments')
    .upsert({
      pupil_id: pupilId,
      term,
      year,
      comment,
      written_by: writtenBy,
    }, { onConflict: 'pupil_id,term,year' })
    .select()
    .single();
  if (error) throw new Error(`Could not save overall comment: ${error.message}`);

  logAuditEvent({
    action: 'report.pupil_comment_saved',
    targetPupilId: pupilId,
    details: { term, year },
  });
  await invalidatePdf({ pupilId, term, year });

  return data;
}

export async function saveConductRatings({ pupilId, term, year, ratings, writtenBy }) {
  const { data, error } = await supabase
    .from('conduct_ratings')
    .upsert({
      pupil_id: pupilId,
      term,
      year,
      written_by: writtenBy,
      ...ratings, // { punctuality, neatness, effort, attentiveness, cooperation }
    }, { onConflict: 'pupil_id,term,year' })
    .select()
    .single();
  if (error) throw new Error(`Could not save conduct: ${error.message}`);

  logAuditEvent({
    action: 'report.conduct_saved',
    targetPupilId: pupilId,
    details: { term, year, ...ratings },
  });
  await invalidatePdf({ pupilId, term, year });

  return data;
}

// ---- Workflow state transitions -------------------------------------------

/**
 * Create or update the report envelope row. Idempotent — re-call as the
 * teacher saves more data; status stays 'draft' until explicit submit.
 */
export async function ensureDraft({ pupilId, classId, schoolId, term, year }) {
  const { data, error } = await supabase
    .from('term_reports')
    .upsert({
      pupil_id: pupilId,
      class_id: classId,
      school_id: schoolId,
      term,
      year,
      status: 'draft',
    }, { onConflict: 'pupil_id,term,year', ignoreDuplicates: false })
    .select()
    .single();
  if (error) throw new Error(`Could not save report: ${error.message}`);
  return data;
}

export async function submitForApproval({ reportId, userId }) {
  const { data, error } = await supabase
    .from('term_reports')
    .update({
      status: 'pending_approval',
      submitted_at: new Date().toISOString(),
      submitted_by: userId,
    })
    .eq('id', reportId)
    .select()
    .single();
  if (error) throw new Error(`Could not submit: ${error.message}`);

  logAuditEvent({
    action: 'report.submitted_for_approval',
    targetPupilId: data.pupil_id,
    targetSchoolId: data.school_id,
    details: { report_id: reportId, term: data.term, year: data.year },
  });
  return data;
}

export async function approveReport({ reportId, userId }) {
  const { data, error } = await supabase
    .from('term_reports')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: userId,
    })
    .eq('id', reportId)
    .select()
    .single();
  if (error) throw new Error(`Could not approve: ${error.message}`);

  logAuditEvent({
    action: 'report.approved',
    targetPupilId: data.pupil_id,
    targetSchoolId: data.school_id,
    details: { report_id: reportId, term: data.term, year: data.year },
  });
  return data;
}

export async function publishReport({ reportId }) {
  const { data, error } = await supabase
    .from('term_reports')
    .update({
      status: 'published',
      published_at: new Date().toISOString(),
    })
    .eq('id', reportId)
    .select()
    .single();
  if (error) throw new Error(`Could not publish: ${error.message}`);

  logAuditEvent({
    action: 'report.published',
    targetPupilId: data.pupil_id,
    targetSchoolId: data.school_id,
    details: { report_id: reportId, term: data.term, year: data.year },
  });
  return data;
}

// ---- PDF render -----------------------------------------------------------

/**
 * Asks the edge function to render the PDF. Returns a signed URL for download
 * (3-hour expiry; renew on each download click).
 */
export async function renderReportPdf({ reportId }) {
  const { data, error } = await supabase.functions.invoke('render-term-report', {
    body: { report_id: reportId },
  });
  if (error) throw new Error(`Could not render PDF: ${error.message}`);
  return data; // { signed_url, storage_path, expires_at }
}

/**
 * Issue a fresh signed URL for an already-rendered PDF. Used by the parent
 * dashboard so links don't expire on bookmark.
 */
export async function getSignedReportUrl({ reportId }) {
  const { data: report, error: rerr } = await supabase
    .from('term_reports')
    .select('pdf_storage_path')
    .eq('id', reportId)
    .single();
  if (rerr) throw new Error(`Could not find report: ${rerr.message}`);
  if (!report.pdf_storage_path) {
    throw new Error('PDF not yet rendered. Try the Generate PDF button first.');
  }
  const { data, error } = await supabase.storage
    .from('term-reports')
    .createSignedUrl(report.pdf_storage_path, 60 * 60 * 3); // 3 hours
  if (error) throw new Error(`Could not sign URL: ${error.message}`);
  return data.signedUrl;
}

// ---- Internal helpers -----------------------------------------------------

/**
 * Clear the cached PDF so the next download triggers a re-render.
 * Called whenever underlying data (scores, comments, conduct) changes.
 * Fire-and-forget — failure here doesn't block the user's edit.
 */
async function invalidatePdf({ pupilId, term, year }) {
  try {
    await supabase
      .from('term_reports')
      .update({ pdf_storage_path: null, pdf_generated_at: null })
      .eq('pupil_id', pupilId)
      .eq('term', term)
      .eq('year', year);
  } catch (e) {
    console.warn('[reports] PDF invalidation failed', e?.message);
  }
}

// ---- Parent-facing --------------------------------------------------------

/**
 * Returns the parent's child's published reports. Used by the parent app
 * Reports tab.
 */
export async function listParentReports({ pupilId }) {
  const { data, error } = await supabase
    .from('term_reports')
    .select('id, term, year, published_at, attendance_present_pct, overall_average, pdf_storage_path')
    .eq('pupil_id', pupilId)
    .eq('status', 'published')
    .order('year', { ascending: false })
    .order('term', { ascending: false });
  if (error) throw new Error(`Could not load reports: ${error.message}`);
  return data ?? [];
}
