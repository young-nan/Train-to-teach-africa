/**
 * src/modules/student/StudentApp.jsx
 *
 * Complete student experience. Replaces the 100% placeholder version.
 *
 * SECTIONS
 * ────────
 * Today      → next lesson card, streak, "just done" recents
 * Lesson     → full lesson player (content + quiz)
 * Roadmap    → term map of all lessons with completion status
 * Library    → completed lessons, replayable
 * Badges     → earned + locked badges
 *
 * DESIGN PRINCIPLES (from architecture doc)
 * ─────────────────
 * - One decision wide: "what do I do next?" is always visible
 * - Touch targets ≥ 48px (shared device, young fingers)
 * - Emoji-forward UI (low reading load for primary-level students)
 * - No school data here — all TTA content
 * - Works offline: lesson content cached after first load
 *
 * IDENTITY
 * ────────
 * Students authenticate with PIN (pupil_code + PIN).
 * The JWT contains pupil_code which RLS uses to scope data.
 * We read the active pupil from auth.jwt().pupil_code → pupils table.
 */

import { useState, useEffect, useCallback, Suspense } from 'react';
import { Routes, Route, Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { UpNextCard } from '@/components/ui/UpNextCard';
import { useAuth } from '@/hooks/useAuth';
import * as studentService from '@/services/studentService';

const NAV = [
  { to: '/app/student',          label: 'Today',   end: true },
  { to: '/app/student/roadmap',  label: 'Roadmap'  },
  { to: '/app/student/library',  label: 'Library'  },
  { to: '/app/student/badges',   label: 'Badges'   },
];

// ── Router ────────────────────────────────────────────────────────────────────

export default function StudentApp() {
  return (
    <Routes>
      <Route index                       element={<TodayView />} />
      <Route path="lesson/:lessonId"     element={<LessonPlayer />} />
      <Route path="roadmap"              element={<RoadmapView />} />
      <Route path="library"             element={<LibraryView />} />
      <Route path="badges"               element={<BadgesView />} />
    </Routes>
  );
}

// ── Today view ────────────────────────────────────────────────────────────────

function TodayView() {
  const { pupilId, pupilName } = useStudentIdentity();
  const navigate = useNavigate();

  // Next lesson
  const { data: nextLesson, isLoading: nextLoading } = useQuery({
    queryKey:  ['student', pupilId, 'next-lesson'],
    queryFn:   () => studentService.getNextLesson(pupilId),
    enabled:   !!pupilId,
    staleTime: 60_000,
  });

  // Streak + stats
  const { data: streak } = useQuery({
    queryKey:  ['student', pupilId, 'streak'],
    queryFn:   () => studentService.getStreak(pupilId),
    enabled:   !!pupilId,
    staleTime: 30_000,
  });

  // Recent completed lessons
  const { data: history } = useQuery({
    queryKey:  ['student', pupilId, 'history'],
    queryFn:   () => studentService.getLessonHistory(pupilId, { page: 1, pageSize: 3 }),
    enabled:   !!pupilId,
    staleTime: 60_000,
  });

  const recentLessons = history?.lessons ?? [];

  return (
    <AppShell title="Today" navItems={NAV}>
      <div className="max-w-[680px]">

        {/* Greeting + streak */}
        <div className="mb-s-7 flex items-center gap-s-4 flex-wrap">
          <h2 className="font-display text-display-2 text-ink-0">
            {greeting()}, {pupilName?.split(' ')[0] ?? 'there'}.
          </h2>
          <div className="flex gap-s-3">
            {streak?.current_streak > 0 && (
              <Chip variant="gold" dot>
                🔥 {streak.current_streak}-day streak
              </Chip>
            )}
            {streak?.total_lessons > 0 && (
              <Chip variant="default">
                📚 {streak.total_lessons} done
              </Chip>
            )}
          </div>
        </div>

        {/* NEXT LESSON — UpNextCard composite */}
        <div className="mb-s-6">
          <UpNextCard
            lesson={nextLesson}
            variant="student"
            isLoading={nextLoading}
            onStart={() => nextLesson && navigate(`/app/student/lesson/${nextLesson.lesson_id}`)}
          />
        </div>

        {!nextLoading && !nextLesson && (
          <Card className="bg-surface-2 border-green-400/25 mb-s-6">
            <div className="text-center py-s-6">
              <div className="text-[48px] mb-s-3">🎉</div>
              <h3 className="font-display text-display-3 text-ink-0 mb-s-2">
                All caught up!
              </h3>
              <p className="text-body text-ink-2">
                You've completed all the lessons available at your level.
                More are being added — check back soon.
              </p>
            </div>
          </Card>
        )}

        {/* Just done */}
        {recentLessons.length > 0 && (
          <>
            <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-4">
              Just done
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-s-3 mb-s-5">
              {recentLessons.map(({ lessons: lesson, last_score }) => (
                <Link
                  key={lesson.id}
                  to={`/app/student/lesson/${lesson.id}`}
                  className="block bg-surface-2 border border-line-1 rounded-r-3 p-s-5 hover:border-gold-400/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-s-2">
                    <div className="font-display text-[16px] text-ink-0 leading-tight">
                      {lesson.title}
                    </div>
                    {last_score != null && (
                      <Chip
                        variant={last_score >= 80 ? 'green' : last_score >= 60 ? 'gold' : 'default'}
                        size="sm"
                      >
                        {last_score}%
                      </Chip>
                    )}
                  </div>
                  <div className="mt-s-2 font-mono text-meta text-ink-3">
                    {lesson.subject}
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}

        {/* Quick nav tiles */}
        <div className="grid grid-cols-3 gap-s-3">
          {[
            { to: '/app/student/roadmap', emoji: '🗺️', label: 'Term map' },
            { to: '/app/student/library', emoji: '📖', label: 'Library'  },
            { to: '/app/student/badges',  emoji: '🏅', label: 'Badges'   },
          ].map(({ to, emoji, label }) => (
            <Link
              key={to}
              to={to}
              className="bg-surface-2 border border-line-1 rounded-r-3 p-s-5 text-center hover:border-gold-400/30 transition-colors"
            >
              <div className="text-[28px] mb-s-2">{emoji}</div>
              <div className="font-mono text-meta text-ink-2">{label}</div>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

// ── Lesson player ─────────────────────────────────────────────────────────────

function LessonPlayer() {
  const { lessonId } = useParams();
  const { pupilId }  = useStudentIdentity();
  const navigate     = useNavigate();
  const qc           = useQueryClient();

  const [phase, setPhase]   = useState('content'); // 'content' | 'quiz' | 'result'
  const [result, setResult] = useState(null);
  const [startTime]         = useState(Date.now());

  const { data: lesson, isLoading } = useQuery({
    queryKey:  ['student', 'lesson', lessonId],
    queryFn:   () => studentService.getLessonForStudent(lessonId),
    staleTime: 600_000,   // 10 min — lesson content is stable
  });

  // Mark as started when lesson loads
  useEffect(() => {
    if (pupilId && lessonId) {
      studentService.startLesson(pupilId, lessonId);
    }
  }, [pupilId, lessonId]);

  const complete = useMutation({
    mutationFn: ({ score }) => studentService.completeLesson({
      pupilId,
      lessonId,
      score,
      durationSeconds: Math.round((Date.now() - startTime) / 1000),
    }),
    onSuccess: (data, variables) => {
      setResult({ score: variables.score, ...data });
      setPhase('result');
      // Invalidate all student queries so TodayView refreshes
      qc.invalidateQueries({ queryKey: ['student', pupilId] });
    },
  });

  if (isLoading) return (
    <AppShell title="Lesson" navItems={NAV}>
      <div className="max-w-[680px] space-y-s-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-r-3 bg-surface-2 border border-line-1 animate-pulse" />
        ))}
      </div>
    </AppShell>
  );

  if (!lesson) return (
    <AppShell title="Lesson" navItems={NAV}>
      <Card><p className="text-body text-ink-2">Lesson not found.</p></Card>
    </AppShell>
  );

  return (
    <AppShell title={lesson.title} navItems={NAV}>
      <div className="max-w-[720px]">
        {/* Back */}
        <button
          onClick={() => navigate('/app/student')}
          className="mb-s-5 font-mono text-meta text-ink-3 hover:text-ink-1"
        >
          ← Today
        </button>

        {/* Lesson header */}
        <div className="mb-s-7">
          <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-2">
            {lesson.subject}{lesson.topic && ` · ${lesson.topic}`}
          </div>
          <h1 className="font-display text-display-1 text-ink-0">{lesson.title}</h1>
          <div className="mt-s-2 font-mono text-meta text-ink-3">
            About {lesson.estimatedMinutes} minutes
          </div>
        </div>

        {/* Content phase */}
        {phase === 'content' && (
          <LessonContent
            lesson={lesson}
            pupilId={pupilId}
            lessonId={lessonId}
            onFinish={() => {
              if (lesson.content?.assessment?.questions?.length > 0) {
                setPhase('quiz');
              } else {
                // No quiz — complete directly with null score
                complete.mutate({ score: null });
              }
            }}
          />
        )}

        {/* Quiz phase */}
        {phase === 'quiz' && lesson.content?.assessment && (
          <QuizSection
            assessment={lesson.content.assessment}
            lessonId={lessonId}
            onComplete={(score) => complete.mutate({ score })}
            isSubmitting={complete.isPending}
          />
        )}

        {/* Result phase */}
        {phase === 'result' && result && (
          <ResultScreen
            result={result}
            lessonTitle={lesson.title}
            onContinue={() => navigate('/app/student')}
            onReplay={() => { setPhase('content'); setResult(null); }}
          />
        )}
      </div>
    </AppShell>
  );
}

// ── IndexedDB lesson session — survives tab close mid-lesson ─────────────────
//
// Stores { lessonId, page, answers } in IndexedDB so a crash or accidental
// close restores the student to exactly where they left off.
// Key: `session:${lessonId}` — one slot per lesson, last-write-wins.

const SESSION_STORE = 'lesson_sessions';

function getSessionDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('tta-lesson-sessions', 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(SESSION_STORE)) {
        req.result.createObjectStore(SESSION_STORE, { keyPath: 'lessonId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveSession(lessonId, page, answers) {
  try {
    const db = await getSessionDb();
    const tx = db.transaction(SESSION_STORE, 'readwrite');
    tx.objectStore(SESSION_STORE).put({ lessonId, page, answers, savedAt: Date.now() });
  } catch { /* IndexedDB unavailable — silently skip. Progress is still saved server-side. */ }
}

async function loadSession(lessonId) {
  try {
    const db = await getSessionDb();
    return await new Promise((res) => {
      const req = db.transaction(SESSION_STORE).objectStore(SESSION_STORE).get(lessonId);
      req.onsuccess = () => res(req.result ?? null);
      req.onerror   = () => res(null);
    });
  } catch { return null; }
}

async function clearSession(lessonId) {
  try {
    const db = await getSessionDb();
    const tx = db.transaction(SESSION_STORE, 'readwrite');
    tx.objectStore(SESSION_STORE).delete(lessonId);
  } catch { /* silent */ }
}

// ── Lesson content ────────────────────────────────────────────────────────────

function LessonContent({ lesson, pupilId, lessonId, onFinish }) {
  const content = lesson.content;

  // Build ordered pages: intro text → main text → each activity card
  const pages = [
    content.introduction && { type: 'reading', body: content.introduction },
    content.mainContent  && { type: 'reading', body: content.mainContent  },
    ...(content.activities ?? []).map((a) => ({
      type: typeof a === 'string' ? 'practice' : (a.type ?? 'interactive'),
      body: a,
    })),
  ].filter(Boolean);

  const [page, setPage]           = useState(0);
  const [sessionLoaded, setSessionLoaded] = useState(false);

  // Restore page position from IndexedDB on mount
  useEffect(() => {
    loadSession(lessonId).then((saved) => {
      if (saved?.page && saved.page < pages.length) {
        setPage(saved.page);
      }
      setSessionLoaded(true);
    });
  }, [lessonId]);

  // Persist page position on every navigation
  useEffect(() => {
    if (!sessionLoaded) return;
    saveSession(lessonId, page, {});
    const pct = Math.round(((page + 1) / Math.max(pages.length, 1)) * 99);
    studentService.updateLessonProgress(pupilId, lessonId, pct);
  }, [page, sessionLoaded]);

  const isLast  = page === pages.length - 1;
  const current = pages[page];

  const handleFinish = () => {
    clearSession(lessonId);
    onFinish();
  };

  if (!sessionLoaded) return null; // brief — avoids flash to page 0 then jump

  if (pages.length === 0) {
    return (
      <div className="text-center py-s-9">
        <p className="text-body text-ink-2 mb-s-5">This lesson's content is being prepared.</p>
        <Button intent="primary" onClick={handleFinish}>Continue</Button>
      </div>
    );
  }

  return (
    <div>
      {/* Progress bar */}
      <div className="mb-s-5 h-[4px] bg-surface-3 rounded-full overflow-hidden">
        <div
          className="h-full bg-gold-400 rounded-full transition-all duration-300"
          style={{ width: `${((page + 1) / pages.length) * 100}%` }}
        />
      </div>
      <div className="font-mono text-meta text-ink-4 mb-s-5">
        {page + 1} / {pages.length}
      </div>

      {/* Content card */}
      <div className="bg-surface-2 border border-line-1 rounded-r-4 mb-s-6 overflow-hidden min-h-[220px]">
        <ActivityCard activity={current} />
      </div>

      {/* Navigation — 48px min touch targets */}
      <div className="flex items-center justify-between gap-s-3">
        <Button
          intent="ghost" size="lg"
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0}
          className="min-h-[48px] min-w-[80px]"
        >
          ← Back
        </Button>
        <div className="flex gap-s-1">
          {pages.map((_, i) => (
            <div
              key={i}
              className={[
                'w-[8px] h-[8px] rounded-full transition-all',
                i === page ? 'bg-gold-400 w-[20px]' : i < page ? 'bg-gold-400/40' : 'bg-surface-4',
              ].join(' ')}
            />
          ))}
        </div>
        <Button
          intent="primary" size="lg"
          onClick={() => isLast ? handleFinish() : setPage((p) => p + 1)}
          className="min-h-[48px] min-w-[100px]"
        >
          {isLast ? 'Finish ✓' : 'Next →'}
        </Button>
      </div>
    </div>
  );
}

// ── Activity card — renders all 4 activity types ──────────────────────────────

function ActivityCard({ activity }) {
  const { type, body } = activity;

  // ── Reading / plain text ──
  if (type === 'reading') {
    const text = typeof body === 'string' ? body : (body?.body ?? '');
    return (
      <div className="p-s-7 sm:p-s-8">
        {text.split('\n\n').map((para, i) => (
          <p key={i} className="text-[17px] text-ink-1 leading-[1.75] mb-s-4 last:mb-0">
            {para}
          </p>
        ))}
      </div>
    );
  }

  // ── Interactive / practice ──
  if (type === 'interactive' || type === 'practice') {
    const title = body?.title ?? '';
    const text  = typeof body === 'string' ? body : (body?.body ?? body?.instruction ?? '');
    const payload = body?.payload ?? {};

    return (
      <div className="p-s-7 sm:p-s-8">
        {title && (
          <div className="flex items-center gap-s-3 mb-s-5">
            <span className="text-[20px]">{type === 'practice' ? '✏️' : '💡'}</span>
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-gold-400">
              {type === 'practice' ? 'Practice' : 'Activity'}
            </span>
          </div>
        )}
        {title && (
          <h3 className="font-display text-[20px] text-ink-0 mb-s-4">{title}</h3>
        )}
        {text && (
          <div className="text-[16px] text-ink-1 leading-[1.7] mb-s-4">
            {text.split('\n\n').map((para, i) => (
              <p key={i} className="mb-s-3 last:mb-0">{para}</p>
            ))}
          </div>
        )}
        {/* Steps list if payload has them */}
        {Array.isArray(payload.steps) && payload.steps.length > 0 && (
          <ol className="mt-s-4 space-y-s-2">
            {payload.steps.map((step, i) => (
              <li key={i} className="flex gap-s-3 text-[15px] text-ink-2">
                <span className="font-mono text-gold-400 shrink-0">{i + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        )}
        {/* Materials list */}
        {Array.isArray(payload.materials) && payload.materials.length > 0 && (
          <div className="mt-s-5 bg-surface-3 rounded-r-2 p-s-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3 mb-s-2">You'll need</p>
            <ul className="space-y-s-1">
              {payload.materials.map((m, i) => (
                <li key={i} className="text-[14px] text-ink-2">• {m}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  // ── Video ──
  if (type === 'video') {
    const url   = body?.payload?.url ?? body?.url ?? '';
    const title = body?.title ?? 'Watch this';
    const text  = body?.body ?? '';

    return (
      <div className="p-s-7 sm:p-s-8">
        <div className="flex items-center gap-s-3 mb-s-4">
          <span className="text-[20px]">▶️</span>
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-gold-400">Video</span>
        </div>
        <h3 className="font-display text-[20px] text-ink-0 mb-s-4">{title}</h3>
        {text && <p className="text-[15px] text-ink-2 mb-s-5">{text}</p>}
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-s-2 bg-gold-400 text-[#1a1305] px-s-5 py-s-3 rounded-r-2 font-medium text-[14px] hover:bg-gold-200 transition-colors min-h-[48px]"
          >
            Watch video ↗
          </a>
        ) : (
          <div className="bg-surface-3 rounded-r-2 p-s-6 text-center text-ink-3 text-[13px]">
            Video coming soon
          </div>
        )}
      </div>
    );
  }

  // ── Fallback ──
  return (
    <div className="p-s-7 sm:p-s-8 text-[15px] text-ink-2">
      {typeof body === 'string' ? body : JSON.stringify(body, null, 2)}
    </div>
  );
}

// ── Quiz section — all 4 question types ──────────────────────────────────────

function QuizSection({ assessment, lessonId, onComplete, isSubmitting }) {
  const questions = assessment?.questions ?? [];
  const passMark  = assessment?.passMark  ?? 60;

  // answers: { [qIdx]: string | number | boolean }
  const [answers,   setAnswers]   = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [correct,   setCorrect]   = useState({});

  // Restore quiz answers from IndexedDB (same session store, answers key)
  useEffect(() => {
    loadSession(lessonId).then((saved) => {
      if (saved?.answers && Object.keys(saved.answers).length > 0) {
        setAnswers(saved.answers);
      }
    });
  }, [lessonId]);

  // Persist answers as student fills them in
  useEffect(() => {
    if (Object.keys(answers).length > 0) {
      loadSession(lessonId).then((saved) => {
        saveSession(lessonId, saved?.page ?? 0, answers);
      });
    }
  }, [answers, lessonId]);

  function setAnswer(qIdx, value) {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [qIdx]: value }));
  }

  const allAnswered = questions.every((_, i) => answers[i] !== undefined && answers[i] !== '');

  function handleSubmit() {
    if (!allAnswered) return;
    setSubmitted(true);

    const newCorrect = {};
    let correctCount = 0;
    questions.forEach((q, i) => {
      let isCorrect = false;
      const ans = answers[i];
      if (q.type === 'mcq') {
        // answer field holds the correct option string; options is the list
        const correctIdx = (q.options ?? []).findIndex(
          (o) => String(o).toLowerCase() === String(q.answer).toLowerCase()
        );
        isCorrect = ans === correctIdx || String(ans) === String(q.answer);
      } else if (q.type === 'true_false') {
        isCorrect = String(ans).toLowerCase() === String(q.answer).toLowerCase();
      } else if (q.type === 'numeric') {
        isCorrect = Math.abs(Number(ans) - Number(q.answer)) < 0.001;
      } else if (q.type === 'short_answer') {
        isCorrect = String(ans).trim().toLowerCase() === String(q.answer).trim().toLowerCase();
      }
      newCorrect[i] = isCorrect;
      if (isCorrect) correctCount++;
    });

    setCorrect(newCorrect);
    const pct = Math.round((correctCount / questions.length) * 100);
    clearSession(lessonId);
    setTimeout(() => onComplete(pct), 1200);
  }

  if (questions.length === 0) {
    onComplete(null);
    return null;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-s-6">
        <div className="font-mono text-eyebrow uppercase text-gold-400">
          Quiz — {questions.length} question{questions.length !== 1 ? 's' : ''}
        </div>
        <div className="font-mono text-meta text-ink-3">Pass: {passMark}%</div>
      </div>

      <div className="space-y-s-6">
        {questions.map((q, qIdx) => (
          <QuestionCard
            key={qIdx}
            question={q}
            index={qIdx}
            answer={answers[qIdx]}
            isCorrect={submitted ? correct[qIdx] : undefined}
            submitted={submitted}
            onAnswer={(val) => setAnswer(qIdx, val)}
          />
        ))}
      </div>

      {!submitted && (
        <Button
          intent="primary" size="lg"
          className="mt-s-7 w-full justify-center min-h-[56px]"
          onClick={handleSubmit}
          disabled={!allAnswered || isSubmitting}
        >
          Submit answers
        </Button>
      )}

      {submitted && (
        <div className="mt-s-5 text-center font-mono text-meta text-ink-3 animate-pulse">
          Saving your score…
        </div>
      )}
    </div>
  );
}

// ── Individual question card ──────────────────────────────────────────────────

function QuestionCard({ question, index, answer, isCorrect, submitted, onAnswer }) {
  const { type, prompt, options = [], answer: correctAnswer, explanation } = question;

  const feedbackClass =
    isCorrect === true  ? 'border-green-400'  :
    isCorrect === false ? 'border-red-400'     : 'border-line-1';

  return (
    <div className={`bg-surface-2 border rounded-r-3 p-s-6 transition-colors ${feedbackClass}`}>
      <div className="flex gap-s-3 mb-s-5">
        <span className="font-mono text-meta text-ink-4 shrink-0 mt-[2px]">{index + 1}.</span>
        <div className="text-[17px] text-ink-0 leading-snug">{prompt}</div>
      </div>

      {/* MCQ */}
      {type === 'mcq' && (
        <div className="space-y-s-2">
          {options.map((opt, oIdx) => {
            const isSelected = answer === oIdx;
            const optIsCorrect = submitted && String(opt).toLowerCase() === String(correctAnswer).toLowerCase();
            const optIsWrong   = submitted && isSelected && !optIsCorrect;
            return (
              <button
                key={oIdx}
                onClick={() => onAnswer(oIdx)}
                disabled={submitted}
                className={[
                  'w-full text-left px-s-4 py-s-4 rounded-r-2 border text-[15px] transition-all min-h-[48px]',
                  optIsCorrect ? 'border-green-400 bg-green-400/10 text-green-300'
                    : optIsWrong   ? 'border-red-400 bg-red-400/10 text-red-300'
                    : isSelected   ? 'border-gold-400 bg-gold-400/10 text-gold-200'
                    : 'border-line-2 bg-surface-3 text-ink-1 hover:border-line-3',
                ].join(' ')}
              >
                <span className="font-mono text-meta mr-s-2">{String.fromCharCode(65 + oIdx)}.</span>
                {opt}
                {optIsCorrect && ' ✓'}
                {optIsWrong   && ' ✗'}
              </button>
            );
          })}
        </div>
      )}

      {/* True / False */}
      {type === 'true_false' && (
        <div className="flex gap-s-3">
          {['True', 'False'].map((val) => {
            const isSelected   = String(answer).toLowerCase() === val.toLowerCase();
            const valIsCorrect = submitted && val.toLowerCase() === String(correctAnswer).toLowerCase();
            const valIsWrong   = submitted && isSelected && !valIsCorrect;
            return (
              <button
                key={val}
                onClick={() => onAnswer(val.toLowerCase())}
                disabled={submitted}
                className={[
                  'flex-1 py-s-4 rounded-r-2 border font-medium text-[15px] transition-all min-h-[48px]',
                  valIsCorrect ? 'border-green-400 bg-green-400/10 text-green-300'
                    : valIsWrong   ? 'border-red-400 bg-red-400/10 text-red-300'
                    : isSelected   ? 'border-gold-400 bg-gold-400/10 text-gold-200'
                    : 'border-line-2 bg-surface-3 text-ink-1 hover:border-line-3',
                ].join(' ')}
              >
                {val}
                {valIsCorrect && ' ✓'}
                {valIsWrong   && ' ✗'}
              </button>
            );
          })}
        </div>
      )}

      {/* Numeric */}
      {type === 'numeric' && (
        <div className="flex items-center gap-s-3">
          <input
            type="number"
            value={answer ?? ''}
            onChange={(e) => onAnswer(e.target.value)}
            disabled={submitted}
            placeholder="Enter a number"
            className={[
              'bg-surface-3 border rounded-r-2 px-s-4 py-s-3 text-[15px] text-ink-0 outline-none',
              'min-h-[48px] w-[160px] transition-colors',
              submitted
                ? isCorrect ? 'border-green-400' : 'border-red-400'
                : 'border-line-2 focus:border-gold-400',
            ].join(' ')}
          />
          {submitted && (
            <span className={isCorrect ? 'text-green-400' : 'text-red-400'}>
              {isCorrect ? '✓ Correct' : `✗ Answer: ${correctAnswer}`}
            </span>
          )}
        </div>
      )}

      {/* Short answer */}
      {type === 'short_answer' && (
        <div>
          <input
            type="text"
            value={answer ?? ''}
            onChange={(e) => onAnswer(e.target.value)}
            disabled={submitted}
            placeholder="Type your answer…"
            className={[
              'w-full bg-surface-3 border rounded-r-2 px-s-4 py-s-3 text-[15px] text-ink-0 outline-none',
              'min-h-[48px] transition-colors',
              submitted
                ? isCorrect ? 'border-green-400' : 'border-red-400'
                : 'border-line-2 focus:border-gold-400',
            ].join(' ')}
          />
          {submitted && !isCorrect && (
            <p className="mt-s-2 text-[13px] text-ink-3">
              Model answer: <span className="text-ink-1">{correctAnswer}</span>
            </p>
          )}
        </div>
      )}

      {/* Explanation after submission */}
      {submitted && explanation && (
        <div className="mt-s-4 bg-surface-3 rounded-r-2 p-s-3 text-[13px] text-ink-2">
          💡 {explanation}
        </div>
      )}
    </div>
  );
}

// ── Result screen ─────────────────────────────────────────────────────────────

function ResultScreen({ result, lessonTitle, onContinue, onReplay }) {
  const { score, streak, newBadges } = result;

  const emoji = score == null ? '✅'
    : score >= 90 ? '🌟'
    : score >= 70 ? '👍'
    : '💪';

  const message = score == null ? 'Lesson complete!'
    : score >= 90 ? 'Excellent work!'
    : score >= 70 ? 'Good job!'
    : 'Keep practising — you\'ve got this!';

  return (
    <div className="text-center py-s-6">
      <div className="text-[72px] mb-s-4">{emoji}</div>

      <h2 className="font-display text-display-2 text-ink-0 mb-s-2">{message}</h2>
      <p className="text-body text-ink-2 mb-s-5">{lessonTitle}</p>

      {score != null && (
        <div className="inline-flex items-center gap-s-4 bg-surface-2 border border-line-1 rounded-r-3 px-s-7 py-s-4 mb-s-6">
          <div>
            <div className="font-mono text-eyebrow uppercase text-ink-3">Score</div>
            <div className="font-display text-[42px] text-ink-0">{score}%</div>
          </div>
          {streak > 1 && (
            <>
              <div className="w-[1px] h-[40px] bg-line-1" />
              <div>
                <div className="font-mono text-eyebrow uppercase text-ink-3">Streak</div>
                <div className="font-display text-[42px] text-gold-400">🔥{streak}</div>
              </div>
            </>
          )}
        </div>
      )}

      {/* New badges */}
      {newBadges?.length > 0 && (
        <div className="mb-s-7">
          <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-3">
            New badge{newBadges.length !== 1 ? 's' : ''} earned!
          </div>
          <div className="flex flex-wrap justify-center gap-s-3">
            {newBadges.map((badge) => (
              <div
                key={badge.slug}
                className="bg-surface-2 border border-gold-400/30 rounded-r-3 px-s-5 py-s-3 flex items-center gap-s-3"
              >
                <span className="text-[28px]">{badge.icon_emoji}</span>
                <div className="text-left">
                  <div className="font-display text-[14px] text-ink-0">{badge.name}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-s-3 justify-center">
        <Button intent="primary" size="lg" onClick={onContinue}>
          What's next →
        </Button>
        {score != null && score < 100 && (
          <Button intent="ghost" size="lg" onClick={onReplay}>
            Try again
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Roadmap view ──────────────────────────────────────────────────────────────

function RoadmapView() {
  const { pupilId } = useStudentIdentity();

  const { data: roadmap, isLoading } = useQuery({
    queryKey:  ['student', pupilId, 'roadmap'],
    queryFn:   () => studentService.getTermRoadmap(pupilId),
    enabled:   !!pupilId,
    staleTime: 60_000,
  });

  // Group by week
  const byWeek = (roadmap ?? []).reduce((acc, lesson) => {
    const wk = lesson.week_of_term ?? 0;
    (acc[wk] ??= []).push(lesson);
    return acc;
  }, {});

  const weeks = Object.keys(byWeek).map(Number).sort((a, b) => a - b);
  const completedCount = (roadmap ?? []).filter((l) => l.isCompleted).length;
  const totalCount     = roadmap?.length ?? 0;

  return (
    <AppShell title="Term Roadmap" navItems={NAV}>
      <div className="max-w-[720px]">
        <div className="mb-s-7">
          <div className="font-mono text-eyebrow uppercase text-gold-400">Roadmap</div>
          <h2 className="mt-s-3 font-display text-display-2 text-ink-0">
            This term's lessons.
          </h2>
          {totalCount > 0 && (
            <div className="mt-s-3 flex items-center gap-s-4">
              <div className="flex-1 h-[8px] bg-surface-3 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gold-400 rounded-full transition-all"
                  style={{ width: `${(completedCount / totalCount) * 100}%` }}
                />
              </div>
              <span className="font-mono text-meta text-ink-2 shrink-0">
                {completedCount}/{totalCount} done
              </span>
            </div>
          )}
        </div>

        {isLoading && (
          <div className="space-y-s-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-r-3 bg-surface-2 border border-line-1 animate-pulse" />
            ))}
          </div>
        )}

        <div className="space-y-s-8">
          {weeks.map((wk) => (
            <div key={wk}>
              <div className="font-mono text-eyebrow uppercase text-ink-3 mb-s-3">
                {wk === 0 ? 'Anytime' : `Week ${wk}`}
              </div>
              <div className="space-y-s-2">
                {byWeek[wk].map((lesson) => (
                  <RoadmapLessonRow key={lesson.id} lesson={lesson} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

function RoadmapLessonRow({ lesson }) {
  return (
    <Link
      to={`/app/student/lesson/${lesson.id}`}
      className={[
        'flex items-center gap-s-4 px-s-4 py-s-4 rounded-r-2 border transition-colors',
        lesson.isCompleted
          ? 'bg-surface-2 border-green-400/20 opacity-75 hover:opacity-100'
          : lesson.isInProgress
          ? 'bg-surface-2 border-gold-400/40'
          : 'bg-surface-2 border-line-1 hover:border-line-3',
      ].join(' ')}
    >
      {/* Status indicator */}
      <div className={[
        'w-[32px] h-[32px] rounded-full border-2 flex items-center justify-center shrink-0 text-[14px]',
        lesson.isCompleted
          ? 'border-green-400 bg-green-400/10'
          : lesson.isInProgress
          ? 'border-gold-400 bg-gold-400/10'
          : 'border-line-2 bg-surface-3',
      ].join(' ')}>
        {lesson.isCompleted ? '✓' : lesson.isInProgress ? '▶' : '○'}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-body text-ink-0 truncate">{lesson.title}</div>
        <div className="font-mono text-meta text-ink-3">{lesson.subject}</div>
      </div>

      {/* Score if done */}
      {lesson.lastScore != null && (
        <Chip
          variant={lesson.lastScore >= 80 ? 'green' : lesson.lastScore >= 60 ? 'gold' : 'default'}
          size="sm"
        >
          {lesson.lastScore}%
        </Chip>
      )}
      {lesson.isInProgress && !lesson.isCompleted && (
        <div className="font-mono text-meta text-gold-400">{lesson.completionPct}%</div>
      )}
    </Link>
  );
}

// ── Library view ──────────────────────────────────────────────────────────────

function LibraryView() {
  const { pupilId } = useStudentIdentity();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey:  ['student', pupilId, 'library', page],
    queryFn:   () => studentService.getLessonHistory(pupilId, { page, pageSize: 12 }),
    enabled:   !!pupilId,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });

  const lessons = data?.lessons ?? [];

  return (
    <AppShell title="Library" navItems={NAV}>
      <div className="max-w-[720px]">
        <div className="mb-s-7">
          <div className="font-mono text-eyebrow uppercase text-gold-400">Library</div>
          <h2 className="mt-s-3 font-display text-display-2 text-ink-0">
            Completed lessons.
          </h2>
          <p className="mt-s-3 text-body text-ink-2">
            Go back and replay any lesson to improve your score.
          </p>
        </div>

        {isLoading && (
          <div className="grid sm:grid-cols-2 gap-s-4">
            {[1,2,3,4].map((i) => (
              <div key={i} className="h-28 rounded-r-3 bg-surface-2 border border-line-1 animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && lessons.length === 0 && (
          <Card>
            <div className="text-center py-s-6">
              <div className="text-[48px] mb-s-3">📚</div>
              <p className="text-body text-ink-2">
                Lessons you complete will appear here for replay.
              </p>
              <Link to="/app/student">
                <Button intent="primary" className="mt-s-4">Start a lesson →</Button>
              </Link>
            </div>
          </Card>
        )}

        <div className="grid sm:grid-cols-2 gap-s-4">
          {lessons.map(({ lessons: lesson, last_score, best_score, attempt_count }) => (
            <Link
              key={lesson.id}
              to={`/app/student/lesson/${lesson.id}`}
              className="block bg-surface-2 border border-line-1 rounded-r-3 p-s-5 hover:border-gold-400/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-s-2 mb-s-2">
                <div className="font-display text-[16px] text-ink-0 leading-tight">
                  {lesson.title}
                </div>
                <Chip
                  variant={best_score >= 80 ? 'green' : best_score >= 60 ? 'gold' : 'default'}
                  size="sm"
                >
                  Best: {best_score ?? '—'}%
                </Chip>
              </div>
              <div className="font-mono text-meta text-ink-3">
                {lesson.subject} · {attempt_count} attempt{attempt_count !== 1 ? 's' : ''}
              </div>
            </Link>
          ))}
        </div>

        {(data?.totalPages ?? 0) > 1 && (
          <div className="mt-s-7 flex justify-center gap-s-2">
            {Array.from({ length: data.totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={[
                  'w-9 h-9 rounded-full font-mono text-meta transition-colors',
                  p === page
                    ? 'bg-gold-400 text-[#1a1305]'
                    : 'bg-surface-2 text-ink-2 hover:bg-surface-3',
                ].join(' ')}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

// ── Badges view ───────────────────────────────────────────────────────────────

function BadgesView() {
  const { pupilId } = useStudentIdentity();

  const { data: badges, isLoading } = useQuery({
    queryKey:  ['student', pupilId, 'badges'],
    queryFn:   () => studentService.getBadges(pupilId),
    enabled:   !!pupilId,
    staleTime: 60_000,
  });

  const { data: streak } = useQuery({
    queryKey:  ['student', pupilId, 'streak'],
    queryFn:   () => studentService.getStreak(pupilId),
    enabled:   !!pupilId,
    staleTime: 30_000,
  });

  return (
    <AppShell title="Badges" navItems={NAV}>
      <div className="max-w-[720px]">
        <div className="mb-s-7">
          <div className="font-mono text-eyebrow uppercase text-gold-400">Badges</div>
          <h2 className="mt-s-3 font-display text-display-2 text-ink-0">
            Your achievements.
          </h2>
          {(badges?.earned?.length ?? 0) > 0 && (
            <p className="mt-s-3 text-body text-ink-2">
              {badges.earned.length} earned · {badges.locked?.length ?? 0} to unlock
            </p>
          )}
        </div>

        {isLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-s-4">
            {[1,2,3,4,5,6].map((i) => (
              <div key={i} className="h-32 rounded-r-3 bg-surface-2 border border-line-1 animate-pulse" />
            ))}
          </div>
        )}

        {/* Earned badges */}
        {(badges?.earned?.length ?? 0) > 0 && (
          <div className="mb-s-8">
            <div className="font-mono text-eyebrow uppercase text-ink-3 mb-s-4">Earned</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-s-4">
              {badges.earned.map((badge) => (
                <div
                  key={badge.id}
                  className="bg-surface-2 border border-gold-400/25 rounded-r-3 p-s-5 text-center"
                >
                  <div className="text-[40px] mb-s-2">{badge.icon_emoji}</div>
                  <div className="font-display text-[14px] text-ink-0 mb-s-1">{badge.name}</div>
                  <div className="font-mono text-[11px] text-ink-3">{badge.description}</div>
                  <div className="mt-s-2 font-mono text-[10px] text-gold-400">
                    {new Date(badge.earnedAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Locked badges */}
        {(badges?.locked?.length ?? 0) > 0 && (
          <div>
            <div className="font-mono text-eyebrow uppercase text-ink-3 mb-s-4">
              Still to unlock
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-s-4">
              {badges.locked.map((badge) => (
                <div
                  key={badge.id}
                  className="bg-surface-2 border border-line-1 rounded-r-3 p-s-5 text-center opacity-50"
                >
                  <div className="text-[40px] mb-s-2 grayscale">{badge.icon_emoji}</div>
                  <div className="font-display text-[14px] text-ink-2 mb-s-1">{badge.name}</div>
                  <div className="font-mono text-[11px] text-ink-3">{badge.description}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isLoading && (badges?.earned?.length ?? 0) === 0 && (
          <Card>
            <div className="text-center py-s-6">
              <div className="text-[48px] mb-s-3">🏅</div>
              <p className="text-body text-ink-2">
                Complete lessons and build streaks to earn badges.
              </p>
              <Link to="/app/student">
                <Button intent="primary" className="mt-s-4">Start learning →</Button>
              </Link>
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Resolve the current student's pupil_id from their session.
 * Students authenticate with pupil_code + PIN. The JWT contains pupil_code.
 * We fetch the pupil row to get the UUID.
 */
function useStudentIdentity() {
  const { user } = useAuth();

  const { data: pupil } = useQuery({
    queryKey:  ['student', 'identity', user?.id],
    queryFn:   async () => {
      // Student session has pupil_code in JWT metadata
      const pupilCode = user?.user_metadata?.pupil_code
        ?? user?.app_metadata?.pupil_code;

      if (!pupilCode) return null;

      const { data } = await import('@/lib/supabase').then(({ supabase }) =>
        supabase
          .from('pupils')
          .select('id, full_name, level')
          .eq('pupil_code', pupilCode)
          .single(),
      );
      return data;
    },
    enabled: !!user,
    staleTime: Infinity,  // identity never changes mid-session
  });

  return {
    pupilId:   pupil?.id ?? null,
    pupilName: pupil?.full_name ?? null,
    level:     pupil?.level ?? null,
  };
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
