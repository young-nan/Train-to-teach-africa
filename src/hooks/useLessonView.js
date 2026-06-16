/**
 * src/hooks/useLessonView.js
 *
 * The role-adaptive lesson engine.
 *
 * One canonical lesson, four projections. The student gets interactive
 * activity + homework but never sees the answer key. The teacher gets
 * objectives, pacing, misconceptions, and the answer key. The parent gets
 * a one-paragraph summary, a 5-minute kitchen activity, and 3 dinner
 * questions. The admin gets the lesson plus engagement analytics.
 *
 * The signature design feature of the platform.
 *
 * THE RULE: this engine is the ONLY place where the lesson is split by role.
 * Components downstream consume `view` and never reach into `layers`
 * themselves — that would scatter role logic everywhere.
 */

import { useMemo } from 'react';
import { ROLES } from '@/config/roles';

/**
 * @param {Lesson} lesson — already validated against LessonSchema
 * @param {string} role — one of ROLES.*
 * @returns {LessonView} role-specific projection
 */
export function useLessonView(lesson, role) {
  return useMemo(() => projectLesson(lesson, role), [lesson, role]);
}

export function projectLesson(lesson, role) {
  if (!lesson) return null;
  const base = {
    id: lesson.id,
    title: lesson.title,
    subject: lesson.subject,
    topic: lesson.topic,
    level: lesson.level,
    estimatedMinutes: lesson.metadata.estimatedMinutes,
  };

  switch (role) {
    case ROLES.STUDENT:
      return {
        ...base,
        kind: 'student',
        body: lesson.layers.studentBody,
        activities: lesson.layers.studentActivities,
        homework: lesson.layers.studentHomework ?? [],
        // assessment is shown but answer key is stripped from each question
        assessment: {
          questions: lesson.assessment.questions.map(stripAnswer),
          passMark: lesson.assessment.passMark,
        },
      };

    case ROLES.TEACHER:
    case ROLES.HEAD_TEACHER:
      return {
        ...base,
        kind: 'teacher',
        objectives: lesson.layers.teacherObjectives,
        pacing: lesson.layers.teacherPacing,
        misconceptions: lesson.layers.teacherMisconceptions ?? [],
        // teacher sees student body so they can teach what the student sees
        studentBody: lesson.layers.studentBody,
        studentActivities: lesson.layers.studentActivities,
        // teacher sees full assessment WITH answers
        assessment: lesson.assessment,
        answerKey: lesson.layers.teacherAnswerKey ?? lesson.assessment.questions,
      };

    case ROLES.PARENT:
      return {
        ...base,
        kind: 'parent',
        summary: lesson.layers.parentSummary,
        kitchenActivity: lesson.layers.parentKitchenActivity,
        dinnerQuestions: lesson.layers.parentDinnerQuestions,
        // parent does NOT see the assessment, the student body, or the answer key.
        // We deliberately keep the parent's surface small — the design research
        // showed parents are paralysed by detail, not under-served by it.
      };

    case ROLES.SCHOOL_ADMIN:
    case ROLES.SUPER_ADMIN:
      return {
        ...base,
        kind: 'admin',
        // admin sees everything except per-pupil answer keys (those are gradebook scope)
        body: lesson.layers.studentBody,
        activities: lesson.layers.studentActivities,
        objectives: lesson.layers.teacherObjectives,
        pacing: lesson.layers.teacherPacing,
        assessment: lesson.assessment,
        // admin-specific: hooks for analytics widgets to render alongside
        analyticsHooks: {
          completionRate: `lesson:${lesson.id}:completion`,
          avgScore: `lesson:${lesson.id}:avg_score`,
          avgDuration: `lesson:${lesson.id}:avg_duration`,
        },
      };

    default:
      // Unknown role — return the safest possible projection (student view
      // without homework). Fail safe rather than fail open.
      return {
        ...base,
        kind: 'unknown',
        body: lesson.layers.studentBody,
        activities: lesson.layers.studentActivities,
      };
  }
}

function stripAnswer(question) {
  const { answer, explanation, ...rest } = question;
  return rest;
}
