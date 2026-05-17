/**
 * src/modules/parent/TonightView.jsx
 *
 * The parent's primary dashboard surface — "what do I do tonight?"
 *
 * WHAT CHANGED (was hardcoded Adaeze + Fractions static content)
 * ─────────────────────────────────────────────────────────────────
 * Now reads live data from `get_tonight_lesson` RPC (migration 0011 Part 4).
 * Returns the current week's lesson for EACH of the parent's linked children,
 * with the parent content layer (parent_summary, kitchen_activity,
 * dinner_questions) extracted server-side — teacher and assessment layers
 * are never returned to this view.
 *
 * MULTI-CHILD HANDLING
 * ──────────────────────
 * If a parent has 2 children, two hero cards render side by side (desktop)
 * or stacked (mobile). The active child tab persists in local state.
 *
 * WHAT THIS VIEW SHOWS
 * ─────────────────────
 * - Tonight's lesson for each child (TTA-matched to their level/week)
 * - 5-minute kitchen activity from the lesson's parent layer
 * - Three dinner discussion questions
 * - Child's TTA progress on tonight's lesson (completion %, last score)
 * - Quick stat cards (attendance / score) from school if connection approved
 *
 * WHAT THIS VIEW NEVER SHOWS
 * ───────────────────────────
 * - Teacher notes or assessment answers
 * - Other pupils' data
 * - School data without an approved parent_school_connection
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { getGreeting } from '@/utils/greeting';
import { supabase } from '@/lib/supabase';
import * as parentSubscriptionService from '@/services/parentSubscriptionService';
import * as schoolConnectionService from '@/services/schoolConnectionService';

const NAV = [
  { to: '/app/parent',             label: 'Tonight',   end: true },
  { to: '/app/parent/children',    label: 'Children'   },
  { to: '/app/parent/lessons',     label: 'Lessons'    },
  { to: '/app/parent/progress',    label: 'Progress'   },
  { to: '/app/parent/reports',     label: 'Reports'    },
  { to: '/app/parent/tutors',      label: 'Tutors'     },
  { to: '/app/parent/subscribe',   label: 'Subscribe'  },
];

export function TonightView() {
  const { user, profile } = useAuth();
  const firstName = profile?.full_name?.split(' ')[0] ?? 'There';
  const [activeChildIdx, setActiveChildIdx] = useState(0);

  // ── Entitlement check ────────────────────────────────────────────────────
  const { data: entitlement } = useQuery({
    queryKey:  ['parent', 'entitlement'],
    queryFn:   () => parentSubscriptionService.getEntitlement(),
    staleTime: 30_000,
  });

  // ── Tonight's lesson data (live from RPC) ────────────────────────────────
  const { data: tonightLessons, isLoading } = useQuery({
    queryKey:  ['parent', 'tonight', user?.id],
    queryFn:   async () => {
      const { data, error } = await supabase.rpc('get_tonight_lesson', {
        p_parent_user_id: user.id,
      });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled:   !!user?.id && !!entitlement,
    staleTime: 5 * 60_000,
    refetchInterval: 15 * 60_000,  // refresh every 15 min (lesson of the day)
  });

  // ── School attendance for connected children ─────────────────────────────
  const { data: connections } = useQuery({
    queryKey:  ['parent', 'connections'],
    queryFn:   () => schoolConnectionService.listMyConnections(),
    staleTime: 5 * 60_000,
  });

  const activeLesson = tonightLessons?.[activeChildIdx];
  const hasMultipleChildren = (tonightLessons?.length ?? 0) > 1;

  return (
    <AppShell title="Tonight" navItems={NAV}>
      <div className="max-w-[820px]">
        {/* Greeting */}
        <div className="mb-s-7">
          <div className="font-mono text-eyebrow uppercase text-gold-400">
            Tonight's home support
          </div>
          <h2 className="mt-s-3 font-display text-display-2 text-ink-0">
            {getGreeting()}, <span className="ital-gold">{firstName}.</span>
          </h2>
        </div>

        {/* No subscription → gate */}
        {!entitlement && !isLoading && (
          <SubscribeGate />
        )}

        {/* No children enrolled yet */}
        {entitlement && !isLoading && (tonightLessons?.length ?? 0) === 0 && (
          <NoChildrenCard />
        )}

        {/* Loading skeleton */}
        {isLoading && entitlement && <TonightSkeleton />}

        {/* Main lesson content */}
        {activeLesson && (
          <>
            {/* Child selector tabs (only if > 1 child) */}
            {hasMultipleChildren && (
              <div className="flex gap-s-2 mb-s-5 flex-wrap">
                {tonightLessons.map((lesson, i) => (
                  <button
                    key={lesson.pupil_id}
                    onClick={() => setActiveChildIdx(i)}
                    className={[
                      'px-s-4 py-s-2 rounded-full text-[12.5px] font-medium border transition-all',
                      i === activeChildIdx
                        ? 'bg-gold-400 text-[#1a1305] border-gold-400'
                        : 'bg-surface-2 text-ink-2 border-line-2 hover:border-line-1',
                    ].join(' ')}
                  >
                    {lesson.pupil_name}
                  </button>
                ))}
              </div>
            )}

            {/* Hero card */}
            <LessonHeroCard lesson={activeLesson} />

            {/* Stats strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-s-4 mt-s-5">
              <ProgressStatCard lesson={activeLesson} />
              <AttendanceStatCard
                pupilId={activeLesson.pupil_id}
                connections={connections}
              />
              <ReportStatCard pupilId={activeLesson.pupil_id} connections={connections} />
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

// ── Lesson hero card ──────────────────────────────────────────────────────────

function LessonHeroCard({ lesson }) {
  const dinnerQuestions = Array.isArray(lesson.dinner_questions)
    ? lesson.dinner_questions
    : typeof lesson.dinner_questions === 'string'
      ? JSON.parse(lesson.dinner_questions)
      : [];

  return (
    <Card className="bg-surface-2 border-line-2 mb-s-2">
      {/* Identity chips */}
      <div className="flex flex-wrap items-center gap-s-3 mb-s-4">
        <Chip variant="gold" dot>
          {lesson.pupil_name} · {formatLevel(lesson.pupil_level)}
        </Chip>
        <Chip variant="default">
          {lesson.lesson_subject}
          {lesson.lesson_topic && ` · ${lesson.lesson_topic}`}
        </Chip>
        {lesson.week_of_term && (
          <span className="font-mono text-meta text-ink-3">
            Week {lesson.week_of_term}
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="font-display text-[28px] leading-tight text-ink-0 mb-s-4">
        {lesson.pupil_name.split(' ')[0]} is learning{' '}
        <span className="ital-gold">{lesson.lesson_title}</span> tonight.
      </h3>

      {/* Parent summary */}
      {lesson.parent_summary && (
        <p className="text-body-l text-ink-2 max-w-[64ch] mb-s-6 leading-relaxed">
          {lesson.parent_summary}
        </p>
      )}

      {/* Activity + questions — two columns */}
      <div className="grid md:grid-cols-2 gap-s-5">
        {lesson.kitchen_activity && (
          <div className="bg-surface-3 border border-gold-400/30 rounded-r-2 p-s-5">
            <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-3">
              5-minute kitchen activity
            </div>
            <p className="text-body text-ink-1 leading-relaxed">
              {lesson.kitchen_activity}
            </p>
          </div>
        )}

        {dinnerQuestions.length > 0 && (
          <div className="bg-surface-3 border border-line-2 rounded-r-2 p-s-5">
            <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-3">
              {dinnerQuestions.length} dinner questions
            </div>
            <ol className="text-body text-ink-1 space-y-s-2 list-decimal list-inside leading-relaxed">
              {dinnerQuestions.slice(0, 3).map((q, i) => (
                <li key={i}>{typeof q === 'string' ? q : q?.question ?? ''}</li>
              ))}
            </ol>
          </div>
        )}
      </div>

      {/* Lesson link */}
      <div className="mt-s-6 flex flex-wrap gap-s-3">
        <Link to={`/app/parent/lessons/${lesson.lesson_id}?child=${lesson.pupil_id}`}>
          <Button intent="primary" size="md">
            Read tonight's lesson →
          </Button>
        </Link>
        <Link to={`/app/parent/lessons/${lesson.lesson_id}/print?child=${lesson.pupil_id}`}
          target="_blank">
          <Button intent="ghost" size="md">Print as PDF</Button>
        </Link>
      </div>
    </Card>
  );
}

// ── Stat cards ────────────────────────────────────────────────────────────────

function ProgressStatCard({ lesson }) {
  const isCompleted   = lesson.completion_pct === 100;
  const isInProgress  = lesson.completion_pct > 0 && lesson.completion_pct < 100;

  return (
    <Card className="bg-surface-2 border-line-2">
      <div className="font-mono text-eyebrow uppercase text-gold-400">
        Tonight's lesson
      </div>
      {isCompleted ? (
        <>
          <div className="mt-s-3 font-display text-[28px] text-ink-0 leading-none">
            {lesson.last_score != null ? `${lesson.last_score}%` : '✓'}
          </div>
          <div className="mt-s-2 font-mono text-meta text-green-400">Completed</div>
        </>
      ) : isInProgress ? (
        <>
          <div className="mt-s-3 font-display text-[28px] text-ink-0 leading-none">
            {lesson.completion_pct}%
          </div>
          <div className="mt-s-2 font-mono text-meta text-amber-400">In progress</div>
        </>
      ) : (
        <>
          <div className="mt-s-3 font-display text-[20px] text-ink-2 leading-tight">
            Not started
          </div>
          <div className="mt-s-2 font-mono text-meta text-ink-3">
            ~{lesson.estimated_minutes} minutes
          </div>
        </>
      )}
    </Card>
  );
}

function AttendanceStatCard({ pupilId, connections }) {
  // Check if this child has an approved connection with attendance sharing
  const approvedConn = connections?.find(
    (c) => c.pupils?.id === pupilId
       && c.status === 'approved'
       && c.share_attendance,
  );

  const { data: attendance } = useQuery({
    queryKey:  ['parent', 'attendance-stat', pupilId],
    queryFn:   () => schoolConnectionService.getApprovedAttendance(pupilId),
    enabled:   !!approvedConn,
    staleTime: 60 * 60_000,  // attendance is slow-moving
    select: (rows) => {
      // Most recent week
      const latest = rows[0];
      if (!latest) return null;
      const total = latest.present_count + latest.absent_count + latest.late_count;
      return { present: latest.present_count, total, week: latest.week_start };
    },
  });

  return (
    <Card className="bg-surface-2 border-line-2">
      <div className="font-mono text-eyebrow uppercase text-gold-400">This week</div>
      {approvedConn && attendance ? (
        <>
          <div className="mt-s-3 font-display text-[28px] text-ink-0 leading-none">
            {attendance.present} / {attendance.total}
          </div>
          <div className="mt-s-2 font-mono text-meta text-ink-3">days at school</div>
        </>
      ) : (
        <>
          <div className="mt-s-3 font-display text-[16px] text-ink-2 leading-tight">
            {approvedConn ? 'No data' : 'Not connected'}
          </div>
          {!approvedConn && (
            <Link to="/app/parent/children" className="mt-s-2 block">
              <span className="font-mono text-meta text-gold-400 hover:underline">
                Connect school →
              </span>
            </Link>
          )}
        </>
      )}
    </Card>
  );
}

function ReportStatCard({ pupilId, connections }) {
  const approvedConn = connections?.find(
    (c) => c.pupils?.id === pupilId
       && c.status === 'approved'
       && c.share_term_reports,
  );

  return (
    <Card className="bg-surface-2 border-line-2">
      <div className="font-mono text-eyebrow uppercase text-gold-400">Reports</div>
      {approvedConn ? (
        <>
          <div className="mt-s-3 font-display text-[16px] text-ink-0 leading-tight">
            School connected
          </div>
          <Link to="/app/parent/reports" className="mt-s-2 block">
            <Button intent="ghost" size="sm">View reports →</Button>
          </Link>
        </>
      ) : (
        <>
          <div className="mt-s-3 font-display text-[16px] text-ink-2 leading-tight">
            Not connected
          </div>
          <Link to="/app/parent/children" className="mt-s-2 block">
            <span className="font-mono text-meta text-gold-400 hover:underline text-sm">
              Connect school →
            </span>
          </Link>
        </>
      )}
    </Card>
  );
}

// ── Empty states ──────────────────────────────────────────────────────────────

function SubscribeGate() {
  return (
    <Card className="border-amber-400/30 bg-amber-400/[0.04]">
      <Chip variant="amber" dot>Subscribe to get started</Chip>
      <h3 className="mt-s-4 font-display text-display-3 text-ink-0">
        Unlock nightly lessons for your children.
      </h3>
      <p className="mt-s-3 text-body text-ink-2 max-w-[55ch]">
        Subscribed parents get a personalised lesson activity every evening,
        matched to what their child is learning in school.
      </p>
      <Link to="/app/parent/subscribe">
        <Button intent="primary" size="md" className="mt-s-5">
          See subscription options →
        </Button>
      </Link>
    </Card>
  );
}

function NoChildrenCard() {
  return (
    <Card className="border-line-2 bg-surface-2">
      <h3 className="font-display text-display-3 text-ink-0">
        Enrol a child to get started.
      </h3>
      <p className="mt-s-3 text-body text-ink-2 max-w-[55ch]">
        Once you enrol a child and choose their level, we'll match them to
        the right lessons and start sending nightly activities.
      </p>
      <Link to="/app/parent/children">
        <Button intent="primary" size="md" className="mt-s-5">
          Enrol a child →
        </Button>
      </Link>
    </Card>
  );
}

function TonightSkeleton() {
  return (
    <div className="space-y-s-5">
      <div className="h-[280px] bg-surface-2 border border-line-1 rounded-r-4 animate-pulse" />
      <div className="grid grid-cols-3 gap-s-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-[100px] bg-surface-2 border border-line-1 rounded-r-3 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatLevel(level) {
  if (!level) return '';
  return level.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
