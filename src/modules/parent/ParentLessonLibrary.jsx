/**
 * src/modules/parent/ParentLessonLibrary.jsx
 *
 * /app/parent/lessons
 *
 * Parents browse and open all published lessons across their children's levels.
 * Gate: requires an active parent subscription. Unsubscribed parents see the
 * lesson catalogue as a preview with a subscribe prompt — not a hard block.
 *
 * Layout:
 *   - Child level tabs (one tab per linked child, or "All" if one child)
 *   - Subject filter pills
 *   - Lesson cards grid — title, subject, topic, duration chip
 *   - Each card links to /app/parent/lessons/:id?child=:childId
 *
 * Design decisions:
 *   - We show ALL published lessons at the child's level, not just tonight's.
 *     Parents who want to get ahead or catch up shouldn't be blocked by the
 *     nightly algorithm.
 *   - Duration chips use the lesson's estimated_minutes — parents plan around
 *     dinner time so 5 min vs 30 min matters.
 *   - No content blob loaded here. Clicking a card opens LessonReaderView
 *     which does the heavy fetch. This keeps the library fast.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import * as simsService from '@/services/simsService';
import * as parentSubscriptionService from '@/services/parentSubscriptionService';
import { supabase } from '@/lib/supabase';
import { cn } from '@/utils/cn';

// ── Helpers ──────────────────────────────────────────────────────────────────

const SUBJECT_ALL = 'All subjects';

function durationLabel(mins) {
  if (!mins) return null;
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function levelLabel(level) {
  return (level ?? '').replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Root ──────────────────────────────────────────────────────────────────────

export function ParentLessonLibrary() {
  const navigate = useNavigate();

  // Linked children — drives the level tabs
  const { data: children, isLoading: childrenLoading } = useQuery({
    queryKey: ['parent', 'children'],
    queryFn:  () => simsService.getMyChildren(),
    staleTime: 300_000,
  });

  // Active subscription check
  const { data: entitlement } = useQuery({
    queryKey: ['parent', 'entitlement'],
    queryFn:  () => parentSubscriptionService.getEntitlement(),
    staleTime: 60_000,
  });

  const hasSubscription = !!entitlement?.is_active;

  // Active child tab — defaults to first child
  const [activeChildIdx, setActiveChildIdx] = useState(0);
  const activeChild = children?.[activeChildIdx] ?? children?.[0];

  // Subject filter
  const [subject, setSubject] = useState(SUBJECT_ALL);

  // Lessons for the active child's level
  const { data: allLessons, isLoading: lessonsLoading } = useQuery({
    queryKey: ['parent', 'lessons', activeChild?.level],
    queryFn: async () => {
      if (!activeChild?.level) return [];
      const { data, error } = await supabase
        .from('lesson_cards_v')
        .select('id, curriculum_code, level, subject, topic, title, week_of_term, sort_index, estimated_minutes')
        .eq('level', activeChild.level)
        .order('sort_index', { ascending: true });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: !!activeChild?.level,
    staleTime: 60_000,
  });

  // Derive subject list from loaded lessons
  const subjects = allLessons
    ? [SUBJECT_ALL, ...new Set(allLessons.map((l) => l.subject).filter(Boolean))]
    : [SUBJECT_ALL];

  // Filter lessons by selected subject
  const lessons = subject === SUBJECT_ALL
    ? (allLessons ?? [])
    : (allLessons ?? []).filter((l) => l.subject === subject);

  // Reset subject when switching children
  const switchChild = (idx) => {
    setActiveChildIdx(idx);
    setSubject(SUBJECT_ALL);
  };

  // ── No children linked ────────────────────────────────────────────────────
  if (!childrenLoading && (!children || children.length === 0)) {
    return (
      <div className="max-w-[820px]">
        <PageHeader />
        <Card className="bg-surface-2 text-center py-s-8">
          <div className="text-[48px] mb-s-4">📚</div>
          <h3 className="font-display text-display-3 text-ink-0 mb-s-3">No children linked yet</h3>
          <p className="text-body text-ink-2 mb-s-5 max-w-[40ch] mx-auto">
            Link a child to a school to unlock lesson browsing for their curriculum level.
          </p>
          <Link to="/app/parent/children">
            <Button intent="primary">Link a child →</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-[980px]">
      <PageHeader />

      {/* Subscription nudge — non-blocking, shown above content */}
      {!hasSubscription && (
        <div className="mb-s-5 bg-gold-400/10 border border-gold-400/30 rounded-r-2 px-s-5 py-s-4 flex items-center justify-between gap-s-5 flex-wrap">
          <div>
            <p className="text-[14px] font-medium text-gold-200">
              Subscribe to unlock lesson content
            </p>
            <p className="text-[13px] text-ink-3 mt-s-1">
              You can browse the catalogue. Subscribe to open and read lessons with your child.
            </p>
          </div>
          <Link to="/app/parent/subscribe" className="shrink-0">
            <Button intent="primary" size="sm">Subscribe →</Button>
          </Link>
        </div>
      )}

      {/* Child level tabs */}
      {children && children.length > 1 && (
        <div className="flex flex-wrap gap-s-2 mb-s-5">
          {children.map((child, idx) => (
            <button
              key={child.id}
              onClick={() => switchChild(idx)}
              className={cn(
                'flex items-center gap-s-2 px-s-4 py-[6px] rounded-full border text-[13px] transition-all',
                idx === activeChildIdx
                  ? 'bg-gold-400/15 border-gold-400/40 text-gold-200'
                  : 'bg-surface-2 border-line-2 text-ink-2 hover:border-line-3',
              )}
            >
              <span className="w-[20px] h-[20px] rounded-full bg-surface-3 grid place-items-center font-mono text-[10px]">
                {child.full_name?.[0]?.toUpperCase()}
              </span>
              {child.full_name?.split(' ')[0]}
              <span className="font-mono text-[10px] text-ink-4">{levelLabel(child.level)}</span>
            </button>
          ))}
        </div>
      )}

      {/* Level label */}
      {activeChild && (
        <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-3">
          {levelLabel(activeChild.level)} · {lessons.length} lesson{lessons.length !== 1 ? 's' : ''}
        </div>
      )}

      {/* Subject filter pills */}
      {subjects.length > 2 && (
        <div className="flex flex-wrap gap-s-2 mb-s-5">
          {subjects.map((s) => (
            <button
              key={s}
              onClick={() => setSubject(s)}
              className={cn(
                'px-s-3 py-[5px] rounded-full border text-[13px] transition-all',
                s === subject
                  ? 'bg-surface-3 border-gold-400/50 text-gold-200'
                  : 'bg-surface-2 border-line-2 text-ink-3 hover:border-line-3 hover:text-ink-1',
              )}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Loading skeleton */}
      {(lessonsLoading || childrenLoading) && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-s-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-[140px] rounded-r-3 bg-surface-2 border border-line-1 animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!lessonsLoading && lessons.length === 0 && (
        <Card className="bg-surface-2 text-center py-s-8">
          <div className="text-[40px] mb-s-3">🔍</div>
          <p className="text-body text-ink-2">
            {subject !== SUBJECT_ALL
              ? `No ${subject} lessons at ${levelLabel(activeChild?.level)} yet.`
              : `No lessons available for ${levelLabel(activeChild?.level)} yet.`}
          </p>
          {subject !== SUBJECT_ALL && (
            <button
              onClick={() => setSubject(SUBJECT_ALL)}
              className="mt-s-4 text-[13px] text-gold-200 hover:text-gold-50"
            >
              Show all subjects
            </button>
          )}
        </Card>
      )}

      {/* Lesson grid */}
      {!lessonsLoading && lessons.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-s-4">
          {lessons.map((lesson) => (
            <LessonCard
              key={lesson.id}
              lesson={lesson}
              childId={activeChild?.id}
              locked={!hasSubscription}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Lesson card ───────────────────────────────────────────────────────────────

function LessonCard({ lesson, childId, locked }) {
  const href = `/app/parent/lessons/${lesson.id}${childId ? `?child=${childId}` : ''}`;

  const card = (
    <div
      className={cn(
        'group bg-surface-2 border rounded-r-3 p-s-5 flex flex-col gap-s-3 transition-all duration-150',
        locked
          ? 'border-line-1 opacity-70 cursor-default'
          : 'border-line-1 hover:border-gold-400/30 hover:bg-surface-3 cursor-pointer',
      )}
    >
      {/* Subject + duration */}
      <div className="flex items-center justify-between gap-s-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-gold-400 truncate">
          {lesson.subject}
        </span>
        {lesson.estimated_minutes && (
          <span className="font-mono text-[10px] text-ink-4 shrink-0">
            {durationLabel(lesson.estimated_minutes)}
          </span>
        )}
      </div>

      {/* Title */}
      <div className="font-display text-[17px] leading-snug text-ink-0 group-hover:text-gold-50 transition-colors">
        {lesson.title}
      </div>

      {/* Topic */}
      {lesson.topic && (
        <p className="text-[12.5px] text-ink-3 leading-relaxed line-clamp-2">
          {lesson.topic}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto pt-s-2">
        {lesson.week_of_term && (
          <span className="font-mono text-[10px] text-ink-4">Week {lesson.week_of_term}</span>
        )}
        {locked ? (
          <span className="font-mono text-[11px] text-ink-4">🔒 Subscribe to read</span>
        ) : (
          <span className="font-mono text-[11px] text-gold-200 opacity-0 group-hover:opacity-100 transition-opacity">
            Open →
          </span>
        )}
      </div>
    </div>
  );

  if (locked) return card;
  return <Link to={href}>{card}</Link>;
}

// ── Page header ───────────────────────────────────────────────────────────────

function PageHeader() {
  return (
    <div className="mb-s-6">
      <div className="font-mono text-eyebrow uppercase text-gold-400">Lesson library</div>
      <h2 className="mt-s-2 font-display text-display-2 text-ink-0">
        All lessons.
      </h2>
      <p className="mt-s-2 text-body text-ink-2 max-w-[52ch]">
        Browse and open any lesson for your child's curriculum level.
        Tonight's suggested lesson is on the home screen.
      </p>
    </div>
  );
}
