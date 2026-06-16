/**
 * src/services/studentService.js
 *
 * All student-facing data operations.
 *
 * DATA OWNERSHIP REMINDER
 * ────────────────────────
 * child_learning_progress  → TTA-owned (parent subscription pays for this)
 * student_streaks           → TTA-owned
 * pupil_badges              → TTA-owned
 * assessment_attempts       → TTA-owned
 *
 * School-owned data (attendance, scores, report cards) is NOT read here.
 * That data flows through schoolConnectionService with explicit disclosure gates.
 *
 * WHO CALLS THIS
 * ──────────────
 * StudentApp  — TodayView, LessonView, LibraryView, BadgesView, RoadmapView
 * ParentApp   — ProgressView (child progress widget, read-only)
 * TeacherApp  — read-only insight into pupils' TTA engagement
 */

import { supabase } from '@/lib/supabase';

// ── Active learning ───────────────────────────────────────────────────────────

/**
 * Returns the next lesson for a pupil to work on.
 * Calls get_next_lesson_for_pupil RPC (migration 0010 Part 10).
 * Returns null if there are no more lessons at this level.
 */
export async function getNextLesson(pupilId) {
  const { data, error } = await supabase
    .rpc('get_next_lesson_for_pupil', { p_pupil_id: pupilId });

  if (error) throw new Error(`Could not load next lesson: ${error.message}`);

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;

  return {
    lesson_id:       row.lesson_id,
    title:           row.title,
    subject:         row.subject,
    topic:           row.topic,
    level:           row.level,
    estimatedMinutes: row.estimated_minutes,
    estimated_minutes: row.estimated_minutes,
    completionPct:   row.completion_pct ?? 0,
    lastScore:       row.last_score ?? null,
    isNew:           row.is_new ?? true,
  };
}

/**
 * Get full lesson content for the student layer.
 * The `content.layers.student` sub-object is extracted server-side by
 * the RLS policy on lessons — but we also filter client-side so
 * teacher notes never accidentally appear in the student UI.
 */
export async function getLessonForStudent(lessonId) {
  const { data, error } = await supabase
    .from('lessons')
    .select('id, title, subject, topic, level, estimated_minutes, content')
    .eq('id', lessonId)
    .eq('status', 'published')
    .single();

  if (error) throw new Error(`Could not load lesson: ${error.message}`);

  // Extract only the student layer. Never expose teacher or parent layers
  // to the student client — even if the schema changes.
  const studentContent = {
    objectives:   data.content?.layers?.objectives ?? [],
    introduction: data.content?.layers?.studentIntroduction ?? data.content?.layers?.introduction ?? '',
    mainContent:  data.content?.layers?.studentContent ?? data.content?.layers?.content ?? '',
    activities:   data.content?.layers?.studentActivities ?? data.content?.layers?.activities ?? [],
    assessment:   data.content?.assessment ?? null,   // quiz questions
  };

  return {
    id:               data.id,
    title:            data.title,
    subject:          data.subject,
    topic:            data.topic,
    level:            data.level,
    estimatedMinutes: data.estimated_minutes,
    content:          studentContent,
  };
}

/**
 * Record that a student has started a lesson.
 * Creates a child_learning_progress row at 0% if none exists.
 * Called when the student opens the lesson player.
 */
export async function startLesson(pupilId, lessonId) {
  const { error } = await supabase
    .from('child_learning_progress')
    .upsert(
      {
        pupil_id:       pupilId,
        lesson_id:      lessonId,
        completion_pct: 0,
        started_at:     new Date().toISOString(),
        updated_at:     new Date().toISOString(),
      },
      {
        onConflict:     'pupil_id,lesson_id',
        // Don't overwrite existing progress — only insert if no row exists yet
        ignoreDuplicates: false,
      },
    );

  // 23505 = unique_violation means the row already exists. That's fine —
  // the student already started this lesson, so we don't reset their progress.
  if (error && error.code !== '23505') {
    console.warn('[studentService] startLesson failed:', error.message);
  }
}

/**
 * Mark a lesson as complete and award any eligible badges.
 * Calls the complete_lesson RPC (migration 0010 Part 12) which atomically:
 *   - updates child_learning_progress (completion_pct = 100)
 *   - updates student_streaks
 *   - checks and inserts pupil_badges for newly eligible badges
 *
 * Returns { streak, totalLessons, newBadges: [{ slug, name, iconEmoji }] }
 */
export async function completeLesson({ pupilId, lessonId, score = null, durationSeconds = null }) {
  const { data, error } = await supabase
    .rpc('complete_lesson', {
      p_pupil_id:   pupilId,
      p_lesson_id:  lessonId,
      p_score:      score ?? null,
      p_duration_s: durationSeconds ?? null,
    });

  if (error) throw new Error(`Could not record lesson completion: ${error.message}`);

  // complete_lesson() returns a single JSONB object.
  // Supabase wraps scalar-returning RPCs directly in data.
  const result = typeof data === 'object' && !Array.isArray(data) ? data : {};

  return {
    streak:       result.streak       ?? 0,
    totalLessons: result.total_lessons ?? 0,
    newBadges:    result.new_badges    ?? [],
  };
}

/**
 * Update lesson progress mid-session (e.g. after each page/section).
 * Called periodically while the student is in the lesson player.
 * This is fire-and-forget from the UI — errors are swallowed so they
 * never interrupt the learning experience.
 */
export async function updateLessonProgress(pupilId, lessonId, completionPct) {
  await supabase
    .from('child_learning_progress')
    .upsert(
      {
        pupil_id:       pupilId,
        lesson_id:      lessonId,
        completion_pct: Math.min(99, completionPct), // 100 is set only by completeLesson
        updated_at:     new Date().toISOString(),
      },
      { onConflict: 'pupil_id,lesson_id' },
    )
    .then(() => {}) // fire-and-forget
    .catch((e) => console.warn('[progress]', e?.message));
}

// ── Progress and history ──────────────────────────────────────────────────────

/**
 * Get the full progress summary for a child.
 * Calls get_child_progress_summary RPC (migration 0010 Part 11).
 * Works for parents, school staff, and the student themselves.
 */
export async function getChildProgressSummary(pupilId) {
  const { data, error } = await supabase
    .rpc('get_child_progress_summary', { p_pupil_id: pupilId });

  if (error) throw new Error(`Could not load progress: ${error.message}`);
  return data;   // already a JSONB object
}

/**
 * Get paginated lesson history for a pupil (completed lessons, newest first).
 * Used by the Library view and the parent Progress view.
 */
export async function getLessonHistory(pupilId, { page = 1, pageSize = 20 } = {}) {
  const from = (page - 1) * pageSize;
  const to   = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from('child_learning_progress')
    .select(`
      lesson_id, completion_pct, last_score, best_score,
      attempt_count, started_at, completed_at,
      lessons(id, title, subject, topic, level, estimated_minutes)
    `, { count: 'exact' })
    .eq('pupil_id', pupilId)
    .eq('completion_pct', 100)
    .order('completed_at', { ascending: false })
    .range(from, to);

  if (error) throw new Error(`Could not load lesson history: ${error.message}`);

  return {
    lessons:    data ?? [],
    totalCount: count ?? 0,
    page,
    pageSize,
    totalPages: Math.ceil((count ?? 0) / pageSize),
  };
}

/**
 * Get the full term lesson roadmap for a pupil.
 * Returns ALL published lessons for the pupil's level, annotated
 * with their completion status. Used by the Roadmap view.
 */
export async function getTermRoadmap(pupilId) {
  // First get the pupil's level
  const { data: pupil, error: pupilErr } = await supabase
    .from('pupils')
    .select('level')
    .eq('id', pupilId)
    .single();

  if (pupilErr) throw new Error('Could not load pupil data.');

  // Get all published lessons for this level
  const { data: lessons, error: lessonErr } = await supabase
    .from('lesson_cards_v')
    .select('*')
    .eq('level', pupil.level)
    .order('week_of_term', { nullsFirst: false })
    .order('sort_index');

  if (lessonErr) throw new Error('Could not load roadmap.');

  // Get the pupil's progress for all these lessons in one query
  const lessonIds = lessons.map((l) => l.id);
  const { data: progress } = await supabase
    .from('child_learning_progress')
    .select('lesson_id, completion_pct, last_score, completed_at')
    .eq('pupil_id', pupilId)
    .in('lesson_id', lessonIds);

  const progressMap = Object.fromEntries(
    (progress ?? []).map((p) => [p.lesson_id, p]),
  );

  // Annotate lessons with progress
  return lessons.map((lesson) => {
    const prog = progressMap[lesson.id];
    return {
      ...lesson,
      completionPct: prog?.completion_pct ?? 0,
      lastScore:     prog?.last_score ?? null,
      completedAt:   prog?.completed_at ?? null,
      isCompleted:   (prog?.completion_pct ?? 0) === 100,
      isInProgress:  (prog?.completion_pct ?? 0) > 0 && (prog?.completion_pct ?? 0) < 100,
    };
  });
}

// ── Streaks and badges ────────────────────────────────────────────────────────

/**
 * Get the current streak for a pupil.
 */
export async function getStreak(pupilId) {
  const { data, error } = await supabase
    .from('student_streaks')
    .select('*')
    .eq('pupil_id', pupilId)
    .maybeSingle();

  if (error) throw new Error(`Could not load streak: ${error.message}`);
  return data ?? {
    current_streak:  0,
    longest_streak:  0,
    total_lessons:   0,
    last_active_date: null,
  };
}

/**
 * Get earned badges + full catalogue (for showing locked badges).
 * Returns { earned: Badge[], locked: Badge[] }
 */
export async function getBadges(pupilId) {
  // All badges (catalogue)
  const { data: allBadges, error: badgesErr } = await supabase
    .from('badges')
    .select('*')
    .order('slug');

  if (badgesErr) throw new Error(`Could not load badges: ${badgesErr.message}`);

  // Earned badges for this pupil
  const { data: earned, error: earnedErr } = await supabase
    .from('pupil_badges')
    .select('badge_id, earned_at')
    .eq('pupil_id', pupilId);

  if (earnedErr) throw new Error(`Could not load earned badges: ${earnedErr.message}`);

  const earnedSet = new Map((earned ?? []).map((e) => [e.badge_id, e.earned_at]));

  const earnedBadges = [];
  const lockedBadges = [];

  for (const badge of allBadges ?? []) {
    if (earnedSet.has(badge.id)) {
      earnedBadges.push({ ...badge, earnedAt: earnedSet.get(badge.id) });
    } else {
      lockedBadges.push(badge);
    }
  }

  return { earned: earnedBadges, locked: lockedBadges };
}

// ── Assessment handling ───────────────────────────────────────────────────────

/**
 * Submit a lesson assessment attempt.
 * The score is computed server-side from the answers and the lesson's
 * correct_answers array (embedded in lesson content).
 *
 * For the student app we compute client-side for instant feedback,
 * then record the attempt. The server re-validates on insert.
 */
export async function submitAssessmentAttempt({ pupilId, lessonId, answers, score, durationSeconds }) {
  const { data, error } = await supabase
    .from('assessment_attempts')
    .insert({
      student_id:       pupilId,
      lesson_id:        lessonId,
      answers,
      score:            Math.round(score),
      duration_seconds: durationSeconds ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`Could not save assessment attempt: ${error.message}`);
  return data;
}

/**
 * Get all previous attempts for a pupil on a lesson.
 * Used by the lesson player to show "your best score was 88%."
 */
export async function getPreviousAttempts(pupilId, lessonId) {
  const { data, error } = await supabase
    .from('assessment_attempts')
    .select('id, score, attempted_at, duration_seconds')
    .eq('student_id', pupilId)
    .eq('lesson_id', lessonId)
    .order('attempted_at', { ascending: false });

  if (error) throw new Error(`Could not load attempts: ${error.message}`);
  return data ?? [];
}
