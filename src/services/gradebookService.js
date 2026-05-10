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
/**
 * Save a batch of scores for a single column.
 *
 * Implementation note: we use lookup-then-update-or-insert rather than
 * upsert with onConflict. Reasons:
 *
 *   1. TLF Lekki SIMS has been doing this in production for years. It works.
 *   2. PostgREST's upsert with `onConflict` requires a matching unique
 *      constraint. Partial unique indexes (which we use because a score
 *      can belong to a gradebook_column OR an assessment, not both) are
 *      finicky to use as conflict targets. If the index name or shape
 *      doesn't match what PostgREST expects, the upsert fails with
 *      "no unique or exclusion constraint matching" and the row vanishes
 *      into the offline queue's failure pile.
 *   3. Two queries per pupil instead of one is fine. A 30-pupil class
 *      saves in well under a second on 4G.
 */
export async function saveColumnScores({ columnId, classId, scores, idempotencyKey }) {
  if (!scores?.length) return [];

  // Pre-flight: refuse if the term is locked. We need the column's term/year
  // to check, so this is one extra round-trip — cheap, and prevents the
  // alternative of a confusing RLS error from a database constraint.
  const { data: column, error: colErr } = await supabase
    .from('gradebook_columns')
    .select('term, year, class_id, classes(school_id)')
    .eq('id', columnId)
    .single();
  if (colErr) throw new Error(`Could not verify column: ${colErr.message}`);
  const schoolId = column.classes?.school_id;
  if (schoolId) {
    const { data: locked } = await supabase.rpc('is_term_locked', {
      p_school_id: schoolId,
      p_term: column.term,
      p_year: column.year,
    });
    if (locked) {
      throw new Error(`This term is locked. Scores can no longer be edited. Contact a head teacher to unlock if needed.`);
    }
  }

  // Step 1: fetch existing scores for these pupils in this column.
  const pupilIds = scores.map((s) => s.pupilId);
  const { data: existing, error: selErr } = await supabase
    .from('scores')
    .select('id, pupil_id, score')
    .eq('gradebook_column_id', columnId)
    .in('pupil_id', pupilIds);
  if (selErr) throw new Error(`Could not load existing scores: ${selErr.message}`);

  const byPupil = new Map((existing ?? []).map((r) => [r.pupil_id, r]));

  // Step 2: split into updates and inserts.
  const toUpdate = [];
  const toInsert = [];
  for (const s of scores) {
    const found = byPupil.get(s.pupilId);
    if (found) {
      // Skip writes where the value is unchanged — saves a round-trip.
      if (found.score !== s.score) {
        toUpdate.push({ id: found.id, score: s.score });
      }
    } else {
      toInsert.push({
        gradebook_column_id: columnId,
        class_id: classId,
        pupil_id: s.pupilId,
        score: s.score,
        max_score: s.maxScore,
        idempotency_key: idempotencyKey,
        // assessment_id is null — score belongs to a column instead
      });
    }
  }

  // Step 3: execute. Updates one by one (small N, can't bulk-update by ID
  // in supabase-js without an RPC). Inserts as one batch.
  const results = [];
  for (const u of toUpdate) {
    const { data, error } = await supabase
      .from('scores')
      .update({ score: u.score })
      .eq('id', u.id)
      .select()
      .single();
    if (error) throw new Error(`Could not update score: ${error.message}`);
    results.push(data);
  }
  if (toInsert.length > 0) {
    const { data, error } = await supabase
      .from('scores')
      .insert(toInsert)
      .select();
    if (error) throw new Error(`Could not insert scores: ${error.message}`);
    results.push(...(data ?? []));
  }

  logAuditEvent({
    action: 'gradebook.scores_saved',
    details: {
      column_id: columnId,
      class_id: classId,
      updated: toUpdate.length,
      inserted: toInsert.length,
      idempotency_key: idempotencyKey,
    },
  });

  return results;
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
