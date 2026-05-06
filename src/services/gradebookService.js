/**
 * src/services/gradebookService.js
 *
 * The IO layer for the gradebook.
 *
 * Two distinct surfaces:
 *
 *   1. COLUMNS — the per-class-per-subject-per-term structure (CA1, CA2, Exam).
 *      Configured once per term, then teachers enter scores against the
 *      configured columns. Schools without an admin can still create columns
 *      themselves the first time they open the gradebook.
 *
 *   2. SCORES — the actual marks. Pupil × column → integer. Goes through
 *      the offline queue like attendance.
 *
 * The hot path — opening the gradebook for a class — uses the
 * `gradebook_grid` RPC, which returns columns + pupils + scores in one
 * round-trip. Saves us an N+1 problem on slow connections.
 */

import { supabase } from '@/lib/supabase';
import { logAuditEvent } from './auditService';

// ---- Columns ---------------------------------------------------------------

export async function listColumns({ classId, subject, term, year }) {
  const { data, error } = await supabase
    .from('gradebook_columns')
    .select('id, name, max_score, weight, position')
    .eq('class_id', classId)
    .eq('subject', subject)
    .eq('term', term)
    .eq('year', year)
    .order('position');
  if (error) throw new Error(`Could not load gradebook columns: ${error.message}`);
  return data ?? [];
}

/**
 * Bulk-create the columns for a term. Used by the column-setup screen
 * when a teacher first opens the gradebook for a fresh term.
 */
export async function createColumns({ classId, subject, term, year, columns }) {
  const rows = columns.map((c, i) => ({
    class_id: classId,
    subject,
    term,
    year,
    name: c.name,
    max_score: c.maxScore,
    weight: c.weight,
    position: c.position ?? i,
  }));
  const { data, error } = await supabase
    .from('gradebook_columns')
    .insert(rows)
    .select();
  if (error) throw new Error(`Could not create columns: ${error.message}`);

  // Fire-and-forget: never blocks the caller, never throws on audit failure.
  logAuditEvent({
    action: 'gradebook.column_created',
    details: {
      class_id: classId,
      subject, term, year,
      column_count: rows.length,
      columns: rows.map((r) => ({ name: r.name, max_score: r.max_score, weight: r.weight })),
    },
  });

  return data;
}

// ---- The hot path: full gradebook in one call -----------------------------

/**
 * Returns { columns, pupils, scores } in a single RPC. The teacher's screen
 * never makes more than one read to render the gradebook.
 */
export async function getGradebook({ classId, subject, term, year }) {
  const { data, error } = await supabase.rpc('gradebook_grid', {
    p_class_id: classId,
    p_subject: subject,
    p_term: term,
    p_year: year,
  });
  if (error) throw new Error(`Could not load gradebook: ${error.message}`);
  return data ?? { columns: [], pupils: [], scores: [] };
}

// ---- Scores ---------------------------------------------------------------

/**
 * Save a batch of scores for a single column. The teacher edits one column
 * at a time on the entry screen, so batching by column is the natural unit.
 *
 * Idempotency keys: each batch carries one shared key, but the upsert
 * conflict target is (gradebook_column_id, pupil_id) which is unique.
 * Replaying the batch is safe.
 */
export async function saveColumnScores({ columnId, classId, scores, idempotencyKey }) {
  const rows = scores.map((s) => ({
    gradebook_column_id: columnId,
    class_id: classId,
    pupil_id: s.pupilId,
    score: s.score,
    max_score: s.maxScore,
    idempotency_key: idempotencyKey,
    // assessment_id is null — score belongs to a column instead
  }));
  const { data, error } = await supabase
    .from('scores')
    .upsert(rows, { onConflict: 'gradebook_column_id,pupil_id' })
    .select();
  if (error) throw new Error(`Could not save scores: ${error.message}`);

  logAuditEvent({
    action: 'gradebook.scores_saved',
    details: {
      column_id: columnId,
      class_id: classId,
      score_count: rows.length,
      idempotency_key: idempotencyKey,
    },
  });

  return data;
}

// ---- Term grade aggregation (used by parent app, reports) -----------------

export async function getTermGrade({ pupilId, subject, term, year }) {
  const { data, error } = await supabase.rpc('term_grade_for_pupil', {
    p_pupil_id: pupilId,
    p_subject: subject,
    p_term: term,
    p_year: year,
  });
  if (error) throw new Error(`Could not load term grade: ${error.message}`);
  return data ?? [];
}
