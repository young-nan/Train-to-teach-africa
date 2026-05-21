/**
 * src/lib/schemas/lesson.js
 *
 * Lesson JSON validation. The brief (Part 12) requires that all lesson
 * transformations be typed. We use Zod to validate any lesson coming from
 * Supabase, an import, or a content authoring tool — before it touches the
 * role-adaptive engine.
 *
 * If a lesson fails this schema, the engine throws and the UI shows an
 * "Unable to load lesson — content team has been notified" state. We never
 * try to render partially-valid lessons.
 */

import { z } from 'zod';

const QuestionSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1),
  type: z.enum(['mcq', 'short_answer', 'numeric', 'true_false']),
  options: z.array(z.string()).optional(),
  answer: z.union([z.string(), z.number(), z.boolean()]),
  explanation: z.string().optional(),
});

const ActivitySchema = z.object({
  id: z.string().min(1),
  type: z.enum(['interactive', 'video', 'reading', 'practice']),
  title: z.string().min(1),
  durationMinutes: z.number().int().positive().max(60),
  body: z.string().min(1),
  // Visualisations and interactive elements use a discriminated payload —
  // the engine knows how to render each `kind`.
  payload: z.record(z.unknown()).optional(),
});

export const LessonSchema = z.object({
  id: z.string().uuid(),
  curriculumCode: z.string().min(1), // e.g. "NERDC.PRI3.MATHS.NUM.05"
  level: z.enum(['nursery_1', 'nursery_2', 'nursery_3', 'primary_1', 'primary_2', 'primary_3', 'primary_4', 'primary_5', 'primary_6']),
  subject: z.string().min(1),
  topic: z.string().min(1),
  title: z.string().min(1),
  // Layered content — the role projection picks one or more layers.
  layers: z.object({
    studentBody: z.string().min(1),
    studentActivities: z.array(ActivitySchema).min(1),
    studentHomework: z.array(QuestionSchema).optional(),
    teacherObjectives: z.array(z.string()).min(1),
    teacherPacing: z.array(z.object({
      minute: z.number().int().nonnegative(),
      action: z.string().min(1),
    })),
    teacherMisconceptions: z.array(z.string()).optional(),
    teacherAnswerKey: z.array(QuestionSchema).optional(),
    parentSummary: z.string().min(1),
    parentKitchenActivity: z.string().min(1),
    parentDinnerQuestions: z.array(z.string()).min(3).max(5),
  }),
  // End-of-lesson check (always shown to students, mark goes to teacher gradebook)
  assessment: z.object({
    questions: z.array(QuestionSchema).min(1).max(10),
    passMark: z.number().int().min(0).max(100),
  }),
  metadata: z.object({
    createdAt: z.string(),
    updatedAt: z.string(),
    authorId: z.string().uuid().optional(),
    estimatedMinutes: z.number().int().positive(),
    version: z.number().int().nonnegative(),
  }),
});

/**
 * Parse and validate. Throws ZodError on failure; the calling service
 * catches and converts to a stable application error.
 */
export function parseLesson(raw) {
  return LessonSchema.parse(raw);
}

/**
 * Safe parse — returns { success, data } | { success: false, error }.
 * Used by the import pipeline where we want to log bad rows but keep going.
 */
export function safeParseLesson(raw) {
  return LessonSchema.safeParse(raw);
}
