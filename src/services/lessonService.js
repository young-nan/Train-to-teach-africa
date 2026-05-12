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
