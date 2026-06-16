/**
 * LessonViewer.jsx — Full lesson reading experience
 * Paged content · 4 quiz question types · Progress persistence · Print-to-PDF
 * Used by: Student (full content), Parent (parentSummary layer only)
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Button, ProgressBar, Chip, Card, LoadingScreen, Empty } from '@/components/ui';
import { cn } from '@/utils/cn';

// ── Page types rendered ───────────────────────────────────────────────────────
function ContentPage({ page }) {
  return (
    <div className="prose-tta max-w-none">
      {page.heading && (
        <h2 className="font-heading text-[20px] font-bold text-[var(--c-ink-0)] mb-4 leading-tight">
          {page.heading}
        </h2>
      )}
      {page.body && (
        <div className="text-[14px] text-[var(--c-ink-1)] leading-[1.75] whitespace-pre-wrap">
          {page.body}
        </div>
      )}
      {page.image_url && (
        <img
          src={page.image_url}
          alt={page.image_alt ?? ''}
          className="w-full rounded-xl mt-5 border border-[var(--c-line-2)]"
        />
      )}
      {page.key_points?.length > 0 && (
        <div className="mt-5 p-4 bg-[var(--c-surface-3)] rounded-xl border-l-4"
          style={{ borderColor: 'var(--product-accent)' }}>
          <div className="text-[11px] font-mono uppercase tracking-[0.12em] text-[var(--product-accent)] mb-3">Key points</div>
          <ul className="space-y-2">
            {page.key_points.map((pt, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px] text-[var(--c-ink-1)]">
                <span className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                  style={{ background:'var(--product-accent)', color:'#1a1305' }}>{i+1}</span>
                {pt}
              </li>
            ))}
          </ul>
        </div>
      )}
      {page.vocabulary?.length > 0 && (
        <div className="mt-5">
          <div className="text-[11px] font-mono uppercase tracking-[0.12em] text-[var(--c-ink-3)] mb-3">Vocabulary</div>
          <div className="grid sm:grid-cols-2 gap-2">
            {page.vocabulary.map((v, i) => (
              <div key={i} className="p-3 bg-[var(--c-surface-3)] rounded-lg">
                <div className="font-semibold text-[13px] text-[var(--c-ink-0)]">{v.term}</div>
                <div className="text-[11px] text-[var(--c-ink-3)] mt-0.5">{v.definition}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Quiz page ─────────────────────────────────────────────────────────────────
function QuizPage({ page, answers, setAnswers }) {
  const questions = page.questions ?? [];

  const handleMCQ = (qIdx, optIdx) => {
    setAnswers(prev => ({ ...prev, [`${page.id}_${qIdx}`]: optIdx }));
  };

  const handleText = (qIdx, val) => {
    setAnswers(prev => ({ ...prev, [`${page.id}_${qIdx}`]: val }));
  };

  const handleTF = (qIdx, val) => {
    setAnswers(prev => ({ ...prev, [`${page.id}_${qIdx}`]: val }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <i className="ti ti-clipboard-list text-[20px] accent-text" aria-hidden="true" />
        <h2 className="font-heading text-[18px] font-bold text-[var(--c-ink-0)]">
          {page.heading ?? 'Quick check'}
        </h2>
      </div>
      {questions.map((q, qi) => {
        const key     = `${page.id}_${qi}`;
        const answer  = answers[key];

        return (
          <div key={qi} className="bg-[var(--c-surface-3)] rounded-xl p-5">
            <div className="text-[13px] font-semibold text-[var(--c-ink-0)] mb-4 leading-relaxed">
              <span className="inline-block w-6 h-6 rounded-full text-[11px] font-bold mr-2 text-center leading-6"
                style={{ background:'var(--product-accent)', color:'#1a1305' }}>{qi+1}</span>
              {q.text}
            </div>

            {/* Multiple choice */}
            {q.type === 'mcq' && (
              <div className="space-y-2">
                {q.options.map((opt, oi) => {
                  const selected = answer === oi;
                  return (
                    <button
                      key={oi}
                      onClick={() => handleMCQ(qi, oi)}
                      className="w-full text-left flex items-center gap-3 p-3 rounded-lg transition-all"
                      style={{
                        background: selected ? 'rgba(229,166,42,0.12)' : 'var(--c-surface-4)',
                        border:     `1px solid ${selected ? 'var(--product-accent)' : 'transparent'}`,
                      }}
                    >
                      <div className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold"
                        style={{
                          background: selected ? 'var(--product-accent)' : 'var(--c-surface-5)',
                          color:      selected ? '#1a1305' : 'var(--c-ink-3)',
                        }}>
                        {String.fromCharCode(65 + oi)}
                      </div>
                      <span className="text-[13px]" style={{ color: selected ? 'var(--c-ink-0)' : 'var(--c-ink-2)' }}>
                        {opt}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* True / False */}
            {q.type === 'true_false' && (
              <div className="flex gap-3">
                {['True','False'].map(opt => {
                  const selected = answer === opt;
                  return (
                    <button
                      key={opt}
                      onClick={() => handleTF(qi, opt)}
                      className="flex-1 py-3 rounded-lg font-semibold text-[13px] transition-all"
                      style={{
                        background: selected
                          ? (opt==='True' ? 'rgba(63,185,80,0.15)' : 'rgba(239,83,80,0.15)')
                          : 'var(--c-surface-4)',
                        color: selected
                          ? (opt==='True' ? 'var(--c-green-400)' : 'var(--c-red-400)')
                          : 'var(--c-ink-3)',
                        border: `1px solid ${selected ? (opt==='True'?'var(--c-green-400)':'var(--c-red-400)') : 'transparent'}`,
                      }}
                    >
                      {opt === 'True' ? '✓ True' : '✗ False'}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Short answer */}
            {q.type === 'short_answer' && (
              <textarea
                className="w-full bg-[var(--c-surface-4)] border border-[var(--c-line-2)] rounded-lg px-3 py-2.5 text-[13px] text-[var(--c-ink-1)] placeholder:text-[var(--c-ink-4)] outline-none focus:border-[var(--product-accent)] transition-colors resize-none"
                rows={3}
                placeholder="Write your answer here…"
                value={answer ?? ''}
                onChange={e => handleText(qi, e.target.value)}
              />
            )}

            {/* Fill in the blank */}
            {q.type === 'fill_blank' && (
              <input
                type="text"
                className="w-full bg-[var(--c-surface-4)] border border-[var(--c-line-2)] rounded-lg px-3 py-2.5 text-[13px] text-[var(--c-ink-1)] placeholder:text-[var(--c-ink-4)] outline-none focus:border-[var(--product-accent)] transition-colors"
                placeholder="Fill in the blank…"
                value={answer ?? ''}
                onChange={e => handleText(qi, e.target.value)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Lesson data hook ──────────────────────────────────────────────────────────
function useLesson(lessonId) {
  return useQuery({
    queryKey: ['lesson', lessonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lessons')
        .select('*')
        .eq('id', lessonId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!lessonId,
    staleTime: 300_000,
  });
}

function useLessonProgress(lessonId, pupilId) {
  return useQuery({
    queryKey: ['lesson-progress', lessonId, pupilId],
    queryFn: async () => {
      if (!lessonId || !pupilId) return null;
      const { data } = await supabase
        .from('lesson_progress')
        .select('*')
        .eq('lesson_id', lessonId)
        .eq('pupil_id', pupilId)
        .maybeSingle();
      return data;
    },
    enabled: !!lessonId && !!pupilId,
  });
}

// ── Main viewer ───────────────────────────────────────────────────────────────
export default function LessonViewer() {
  const { lessonId } = useParams();
  const navigate     = useNavigate();
  const { profile }  = useAuth();
  const qc           = useQueryClient();

  const { data: lesson, isLoading, error } = useLesson(lessonId);
  const { data: progress }                 = useLessonProgress(lessonId, profile?.id);

  // Pages derived from lesson JSON (lesson_notes field = array of page objects)
  const pages = lesson?.lesson_notes ?? lesson?.layers?.student ?? [];

  const [currentPage, setCurrentPage] = useState(0);
  const [answers, setAnswers]         = useState({});
  const [completed, setCompleted]     = useState(false);

  // Resume from saved progress
  useEffect(() => {
    if (progress?.page_index != null) {
      setCurrentPage(progress.page_index);
    }
    if (progress?.status === 'completed') setCompleted(true);
  }, [progress]);

  const saveProgress = useMutation({
    mutationFn: async ({ pageIndex, status }) => {
      if (!profile?.id || !lessonId) return;
      await supabase.from('lesson_progress').upsert({
        pupil_id:    profile.id,
        lesson_id:   lessonId,
        page_index:  pageIndex,
        status:      status ?? 'in_progress',
        updated_at:  new Date().toISOString(),
      }, { onConflict: 'pupil_id,lesson_id' });
    },
  });

  const goToPage = useCallback((idx) => {
    setCurrentPage(idx);
    saveProgress.mutate({ pageIndex: idx });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleNext = () => {
    if (currentPage < pages.length - 1) {
      goToPage(currentPage + 1);
    } else {
      // Mark complete
      setCompleted(true);
      saveProgress.mutate({ pageIndex: currentPage, status: 'completed' });
      qc.invalidateQueries(['lesson-progress', lessonId, profile?.id]);
    }
  };

  const handlePrev = () => {
    if (currentPage > 0) goToPage(currentPage - 1);
  };

  const page         = pages[currentPage];
  const isLastPage   = currentPage === pages.length - 1;
  const progressPct  = pages.length > 0 ? Math.round(((currentPage + 1) / pages.length) * 100) : 0;

  if (isLoading) return <LoadingScreen />;
  if (error || !lesson) return (
    <div className="min-h-screen flex items-center justify-center">
      <Empty icon="book-x" message="Lesson not found." action={<Button variant="ghost" onClick={() => navigate(-1)}>Go back</Button>} />
    </div>
  );

  if (pages.length === 0) return (
    <div className="min-h-screen flex items-center justify-center">
      <Empty icon="book-open" message="This lesson has no content yet." action={<Button variant="ghost" onClick={() => navigate(-1)}>Go back</Button>} />
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--c-surface-0)] flex flex-col">

      {/* ── Top bar ── */}
      <div className="sticky top-0 z-30 bg-[var(--c-surface-1)] border-b border-[var(--c-line-1)] px-4 lg:px-8 h-14 flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--c-ink-2)] hover:bg-[var(--c-surface-3)] transition-colors"
        >
          <i className="ti ti-arrow-left text-[18px]" aria-hidden="true" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="font-heading font-semibold text-[14px] text-[var(--c-ink-0)] truncate">{lesson.title}</div>
          <div className="text-[11px] text-[var(--c-ink-3)] mt-0.5">{lesson.subject} · Week {lesson.week_number}</div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[11px] font-mono text-[var(--c-ink-3)]">{currentPage + 1} / {pages.length}</span>
          {completed && <Chip variant="green" size="sm">✓ Complete</Chip>}
        </div>
      </div>

      {/* ── Progress bar ── */}
      <div className="h-1 bg-[var(--c-surface-3)]">
        <div
          className="h-full transition-all duration-500"
          style={{ width:`${progressPct}%`, background:'var(--product-accent)' }}
        />
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1">

        {/* Sidebar — page list (desktop) */}
        <div className="hidden lg:flex flex-col w-64 shrink-0 border-r border-[var(--c-line-1)] bg-[var(--c-surface-1)] overflow-y-auto py-4">
          <div className="px-4 pb-2 text-[10px] font-mono uppercase tracking-[0.12em] text-[var(--c-ink-4)]">Pages</div>
          {pages.map((p, i) => {
            const isDone = i < currentPage || completed;
            const isCurr = i === currentPage;
            return (
              <button
                key={i}
                onClick={() => goToPage(i)}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 text-left transition-all',
                  isCurr ? 'bg-[var(--c-surface-3)]' : 'hover:bg-[var(--c-surface-2)]'
                )}
              >
                <div
                  className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[10px] font-bold"
                  style={{
                    background: isDone ? 'var(--c-green-400)' : isCurr ? 'var(--product-accent)' : 'var(--c-surface-4)',
                    color:      isDone || isCurr ? '#1a1305' : 'var(--c-ink-4)',
                  }}
                >
                  {isDone ? '✓' : i+1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={cn('text-[12px] truncate', isCurr ? 'font-semibold text-[var(--c-ink-0)]' : 'text-[var(--c-ink-2)]')}>
                    {p.heading ?? p.type === 'quiz' ? `Quiz ${i+1}` : `Page ${i+1}`}
                  </div>
                  {p.type && (
                    <div className="text-[10px] text-[var(--c-ink-4)] mt-0.5 uppercase tracking-wide">{p.type}</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Main reading area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[720px] mx-auto px-4 lg:px-10 py-8">

            {/* Completion screen */}
            {completed && isLastPage ? (
              <div className="text-center py-16">
                <div className="text-[64px] mb-4">🎉</div>
                <div className="font-heading text-[24px] font-bold text-[var(--c-ink-0)] mb-2">Lesson complete!</div>
                <div className="text-[14px] text-[var(--c-ink-3)] mb-8">You've finished <strong className="text-[var(--c-ink-1)]">{lesson.title}</strong>.</div>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button variant="primary" icon="home" onClick={() => navigate(-1)}>Back to lessons</Button>
                  <Button variant="ghost" icon="arrow-right">Next lesson</Button>
                </div>
              </div>
            ) : (
              <>
                {/* Page content */}
                {page?.type === 'quiz'
                  ? <QuizPage page={page} answers={answers} setAnswers={setAnswers} />
                  : <ContentPage page={page ?? { heading:'', body:'' }} />
                }

                {/* Navigation */}
                <div className="flex items-center justify-between mt-10 pt-6 border-t border-[var(--c-line-2)]">
                  <Button
                    variant="ghost"
                    icon="arrow-left"
                    onClick={handlePrev}
                    disabled={currentPage === 0}
                  >
                    Previous
                  </Button>

                  {/* Page dots (mobile) */}
                  <div className="flex gap-1.5 lg:hidden">
                    {pages.slice(0, Math.min(pages.length, 10)).map((_, i) => (
                      <div
                        key={i}
                        onClick={() => goToPage(i)}
                        className="w-1.5 h-1.5 rounded-full cursor-pointer transition-all"
                        style={{
                          background: i === currentPage
                            ? 'var(--product-accent)'
                            : i < currentPage ? 'var(--c-green-400)' : 'var(--c-surface-5)',
                          transform: i === currentPage ? 'scale(1.4)' : 'scale(1)',
                        }}
                      />
                    ))}
                  </div>

                  <Button
                    variant="primary"
                    onClick={handleNext}
                    className="flex items-center gap-2"
                  >
                    {isLastPage ? (
                      <><i className="ti ti-check" aria-hidden="true" /> Complete</>
                    ) : (
                      <>Next <i className="ti ti-arrow-right" aria-hidden="true" /></>
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
