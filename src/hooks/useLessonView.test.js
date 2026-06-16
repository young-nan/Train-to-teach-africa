/**
 * Role-adaptive engine tests.
 *
 * The most important assertion in the entire test suite: the student
 * projection MUST NOT contain the answer to any assessment question.
 * If this regresses, every student in the system can read off correct
 * answers from network responses.
 */

import { describe, it, expect } from 'vitest';
import { projectLesson } from './useLessonView';
import { ROLES } from '@/config/roles';

const fixtureLesson = {
  id: '00000000-0000-4000-8000-000000000001',
  curriculumCode: 'NERDC.PRI3.MATHS.NUM.05',
  level: 'primary_3',
  subject: 'Mathematics',
  topic: 'Fractions',
  title: 'Fractions of a whole',
  layers: {
    studentBody: 'A fraction is part of a whole.',
    studentActivities: [{ id: 'a1', type: 'interactive', title: 'Drag the bars', durationMinutes: 5, body: '...' }],
    studentHomework: [],
    teacherObjectives: ['Pupils can identify halves and quarters.'],
    teacherPacing: [{ minute: 0, action: 'Recap last lesson' }],
    teacherMisconceptions: ['"Bigger denominator = bigger fraction" is wrong'],
    teacherAnswerKey: [],
    parentSummary: 'Your child is learning halves and quarters tonight.',
    parentKitchenActivity: 'Cut a pancake into halves and quarters with your child.',
    parentDinnerQuestions: [
      'How many halves make a whole?',
      'Show me a quarter using your fingers.',
      'Which is bigger, a half or a quarter?',
    ],
  },
  assessment: {
    questions: [
      { id: 'q1', prompt: 'How many quarters make a whole?', type: 'numeric', answer: 4, explanation: 'Four quarters = one whole.' },
    ],
    passMark: 60,
  },
  metadata: {
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    estimatedMinutes: 30,
    version: 1,
  },
};

describe('useLessonView · role projection', () => {
  it('strips answers from the student view', () => {
    const view = projectLesson(fixtureLesson, ROLES.STUDENT);
    expect(view.kind).toBe('student');
    expect(view.assessment.questions[0]).not.toHaveProperty('answer');
    expect(view.assessment.questions[0]).not.toHaveProperty('explanation');
    expect(view.assessment.questions[0]).toHaveProperty('prompt');
  });

  it('gives teachers the answer key', () => {
    const view = projectLesson(fixtureLesson, ROLES.TEACHER);
    expect(view.kind).toBe('teacher');
    expect(view.assessment.questions[0].answer).toBe(4);
    expect(view.misconceptions).toHaveLength(1);
  });

  it('gives parents only the summary surface', () => {
    const view = projectLesson(fixtureLesson, ROLES.PARENT);
    expect(view.kind).toBe('parent');
    expect(view).not.toHaveProperty('assessment');
    expect(view).not.toHaveProperty('body');
    expect(view).not.toHaveProperty('answerKey');
    expect(view.dinnerQuestions).toHaveLength(3);
  });

  it('handles unknown role with a safe fallback (no answer key)', () => {
    const view = projectLesson(fixtureLesson, 'unrecognised_role');
    expect(view.kind).toBe('unknown');
    expect(view).not.toHaveProperty('answerKey');
  });

  it('returns null when given no lesson', () => {
    expect(projectLesson(null, ROLES.STUDENT)).toBeNull();
  });
});
