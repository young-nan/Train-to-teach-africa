/**
 * src/services/lessonService.js
 *
 * All lesson IO. The role-adaptive engine (useLessonView) consumes the
 * canonical lesson shape returned by this service.
 *
 * Lessons returned here are ALREADY validated against LessonSchema. Callers
 * never have to think about partial / malformed lesson data.
 */

import { supabase } from '@/lib/supabase';
import { parseLesson } from '@/lib/schemas/lesson';

/**
 * List lessons for a learner — driven by curriculum level + subject + week.
 * Returns lightweight cards (id, title, topic, subject, durationMinutes) — NOT
 * the full lesson body. The body is fetched lazily by getLesson(id).
 */
export async function listLessonsForStudent({ studentId, level, subject, weekOfTerm }) {
  let query = supabase
    .from('lesson_cards_v')      // view that exposes only safe-for-list fields
    .select('*')
    .eq('level', level);

  if (subject) query = query.eq('subject', subject);
  if (weekOfTerm) query = query.eq('week_of_term', weekOfTerm);

  const { data, error } = await query.order('sort_index');
  if (error) throw new Error(`Could not load lessons: ${error.message}`);
  return data ?? [];
}

/**
 * Fetch a single lesson. Validates against LessonSchema before returning.
 */
/**
 * Lightweight pupil summary for the parent-side personalisation banner.
 * RLS on `pupils` restricts a parent to their linked children, so this
 * call returns null if the parent isn't linked.
 */
export async function getChildSummary(pupilId) {
  if (!pupilId) return null;
  const { data, error } = await supabase
    .from('pupils')
    .select('id, full_name, level, class_id, classes(name)')
    .eq('id', pupilId)
    .maybeSingle();
  if (error) {
    console.warn('[lesson] getChildSummary:', error.message);
    return null;
  }
  return data;
}

export async function getLesson(lessonId) {
  const { data, error } = await supabase
    .from('lessons')
    .select('*')
    .eq('id', lessonId)
    .single();
  if (error) throw new Error(`Could not load lesson: ${error.message}`);

  // Hydrate the JSONB `content` column into the canonical lesson shape.
  const raw = {
    id: data.id,
    curriculumCode: data.curriculum_code,
    level: data.level,
    subject: data.subject,
    topic: data.topic,
    title: data.title,
    layers: data.content?.layers,
    assessment: data.content?.assessment,
    metadata: {
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      authorId: data.author_id,
      estimatedMinutes: data.estimated_minutes,
      version: data.version,
    },
  };

  return parseLesson(raw);
}

/**
 * Record a student's attempt at the end-of-lesson assessment. The score
 * server-side feeds the teacher gradebook AND the parent dashboard.
 *
 * This is also the only write path that survives offline — see
 * src/lib/offline/queue.js.
 */
export async function submitAssessmentAttempt({ studentId, lessonId, answers, score, durationSeconds }) {
  const { data, error } = await supabase
    .from('assessment_attempts')
    .insert({
      student_id: studentId,
      lesson_id: lessonId,
      answers,
      score,
      duration_seconds: durationSeconds,
    })
    .select()
    .single();
  if (error) throw new Error(`Could not save attempt: ${error.message}`);
  return data;
}

/**
 * What lesson should this student see next? Server-side function decides
 * (curriculum order, mastery, recovery suggestions). We never compute this
 * client-side — the recommendation rule must be auditable.
 */
export async function getNextRecommendedLesson(studentId) {
  const { data, error } = await supabase.rpc('next_lesson_for_student', {
    p_student_id: studentId,
  });
  if (error) throw new Error(`Could not get recommendation: ${error.message}`);
  return data; // { lesson_id, reason } | null
}


// =============================================================================
// Admin / SuperAdmin write operations
// =============================================================================

/**
 * Import a single lesson from the authoring tool.
 * `lessonData` is the raw object straight from JSON parse — we re-validate here.
 * Returns the inserted DB row on success, throws on validation or DB error.
 */
export async function importLesson(lessonData) {
  // Validate — throws ZodError on bad shape
  const parsed = parseLesson(lessonData);

  const row = {
    curriculum_code:   parsed.curriculumCode,
    level:             parsed.level,
    subject:           parsed.subject,
    topic:             parsed.topic,
    title:             parsed.title,
    week_of_term:      lessonData.weekOfTerm ?? null,
    sort_index:        lessonData.sortIndex ?? 0,
    estimated_minutes: parsed.metadata.estimatedMinutes,
    version:           parsed.metadata.version,
    status:            lessonData.status ?? 'published',
    content: {
      layers:     parsed.layers,
      assessment: parsed.assessment,
    },
  };

  const { data, error } = await supabase
    .from('lessons')
    .upsert(row, { onConflict: 'curriculum_code' })   // idempotent re-import
    .select()
    .single();

  if (error) throw new Error(`Import failed: ${error.message}`);
  return data;
}

/**
 * Bulk import from a JSON array. Processes each row independently so one
 * bad lesson doesn't abort the whole batch.
 *
 * Returns { imported: number, failed: Array<{ index, title, error }> }
 */
export async function bulkImportLessons(lessons) {
  if (!Array.isArray(lessons)) throw new Error('Expected a JSON array of lessons.');
  if (lessons.length === 0) throw new Error('Array is empty — nothing to import.');
  if (lessons.length > 200) throw new Error('Maximum 200 lessons per import batch.');

  const results = { imported: 0, failed: [] };

  for (let i = 0; i < lessons.length; i++) {
    try {
      await importLesson(lessons[i]);
      results.imported++;
    } catch (err) {
      results.failed.push({
        index: i,
        title: lessons[i]?.title ?? `Row ${i}`,
        error: err.message,
      });
    }
  }

  return results;
}

/**
 * List all lessons for the SuperAdmin content browser.
 * Returns paginated rows with lightweight fields only (no content blob).
 */
export async function listAllLessonsAdmin({ level, subject, status, search, page = 0, pageSize = 50 } = {}) {
  let query = supabase
    .from('lessons')
    .select('id, curriculum_code, level, subject, topic, title, week_of_term, sort_index, status, estimated_minutes, version, created_at, updated_at', { count: 'exact' });

  if (level)   query = query.eq('level', level);
  if (subject) query = query.eq('subject', subject);
  if (status)  query = query.eq('status', status);
  if (search)  query = query.or(`title.ilike.%${search}%,topic.ilike.%${search}%,curriculum_code.ilike.%${search}%`);

  query = query.order('level').order('sort_index').range(page * pageSize, (page + 1) * pageSize - 1);

  const { data, error, count } = await query;
  if (error) throw new Error(`Could not load lessons: ${error.message}`);
  return { lessons: data ?? [], total: count ?? 0 };
}

/**
 * Archive (soft-delete) a lesson. The lesson is hidden from students and
 * teachers but not destroyed — audit trail stays intact.
 */
export async function archiveLesson(lessonId) {
  const { error } = await supabase
    .from('lessons')
    .update({ status: 'archived', updated_at: new Date().toISOString() })
    .eq('id', lessonId);
  if (error) throw new Error(`Could not archive lesson: ${error.message}`);
}

/**
 * Restore an archived lesson back to published.
 */
export async function restoreLesson(lessonId) {
  const { error } = await supabase
    .from('lessons')
    .update({ status: 'published', updated_at: new Date().toISOString() })
    .eq('id', lessonId);
  if (error) throw new Error(`Could not restore lesson: ${error.message}`);
}
