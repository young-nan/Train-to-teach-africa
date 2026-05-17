/**
 * src/modules/parent/ProgressView.jsx
 *
 * /app/parent/progress
 *
 * Shows TTA learning progress for each linked child.
 * Data comes from:
 *   - parent_child_progress_v view  → streaks, lesson counts, avg score
 *   - child_learning_progress table → recent completed lessons
 *   - pupil_badges table            → earned badges
 *   - parent_approved_attendance_v  → attendance (only if school connection approved)
 *   - parent_approved_scores_v      → score summary (only if approved)
 *
 * DATA OWNERSHIP CLARITY
 * ──────────────────────
 * The top section (TTA Learning) shows TTA-owned progress — always visible
 * to subscribed parents regardless of school connection.
 *
 * The bottom section (School Data) shows school-owned data — only visible
 * when parent_school_connections.status = 'approved' AND the relevant
 * share_* flag is true. If not connected, we show a prompt to connect.
 *
 * This separation must be visually clear in the UI so parents understand
 * the difference between TTA progress and school performance.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import * as studentService from '@/services/studentService';
import * as schoolConnectionService from '@/services/schoolConnectionService';
import * as parentSubscriptionService from '@/services/parentSubscriptionService';

const NAV = [
  { to: '/app/parent',           label: 'Tonight',  end: true },
  { to: '/app/parent/children',  label: 'Children'  },
  { to: '/app/parent/lessons',   label: 'Lessons'   },
  { to: '/app/parent/progress',  label: 'Progress'  },
  { to: '/app/parent/reports',   label: 'Reports'   },
  { to: '/app/parent/tutors',    label: 'Tutors'    },
  { to: '/app/parent/subscribe', label: 'Subscribe' },
];

export function ProgressView() {
  const { user } = useAuth();
  const [selectedChild, setSelectedChild] = useState(null);

  // Entitlement gate
  const { data: entitlement } = useQuery({
    queryKey: ['parent', 'entitlement'],
    queryFn:  () => parentSubscriptionService.getEntitlement(),
    staleTime: 30_000,
  });

  // All children's progress from the view
  const { data: childrenProgress, isLoading } = useQuery({
    queryKey:  ['parent', 'progress', user?.id],
    queryFn:   async () => {
      const { data, error } = await supabase
        .from('parent_child_progress_v')
        .select('*');
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled:   !!user?.id && !!entitlement,
    staleTime: 60_000,
  });

  // Connections (for school data section)
  const { data: connections } = useQuery({
    queryKey: ['parent', 'connections'],
    queryFn:  () => schoolConnectionService.listMyConnections(),
    staleTime: 5 * 60_000,
  });

  // Auto-select first child
  const activeChild = selectedChild
    ? childrenProgress?.find((c) => c.pupil_id === selectedChild)
    : childrenProgress?.[0];

  const hasMultiple = (childrenProgress?.length ?? 0) > 1;

  return (
    <AppShell title="Progress" navItems={NAV}>
      <div className="max-w-[820px]">
        {/* Header */}
        <div className="mb-s-7">
          <div className="font-mono text-eyebrow uppercase text-gold-400">Progress</div>
          <h2 className="mt-s-3 font-display text-display-2 text-ink-0">
            Learning progress.
          </h2>
          <p className="mt-s-3 text-body text-ink-2 max-w-[58ch]">
            Your children's TTA learning activity and, where your school
            has approved it, their school performance data.
          </p>
        </div>

        {/* No subscription */}
        {!entitlement && !isLoading && (
          <Card className="border-amber-400/30 bg-amber-400/[0.04]">
            <Chip variant="amber" dot>Subscribe to view progress</Chip>
            <p className="mt-s-3 text-body text-ink-2">
              Subscribe to track your children's TTA learning progress.
            </p>
            <Link to="/app/parent/subscribe">
              <Button intent="primary" size="md" className="mt-s-4">
                See plans →
              </Button>
            </Link>
          </Card>
        )}

        {isLoading && <ProgressSkeleton />}

        {entitlement && !isLoading && (childrenProgress?.length ?? 0) === 0 && (
          <Card className="bg-surface-2 border-line-2">
            <p className="text-body text-ink-2">
              No children enrolled yet.{' '}
              <Link to="/app/parent/children" className="text-gold-200 hover:underline">
                Enrol a child →
              </Link>
            </p>
          </Card>
        )}

        {/* Child picker */}
        {hasMultiple && (
          <div className="flex gap-s-2 mb-s-6 flex-wrap">
            {childrenProgress.map((child) => (
              <button
                key={child.pupil_id}
                onClick={() => setSelectedChild(child.pupil_id)}
                className={[
                  'px-s-4 py-s-2 rounded-full text-[12.5px] font-medium border transition-all',
                  activeChild?.pupil_id === child.pupil_id
                    ? 'bg-gold-400 text-[#1a1305] border-gold-400'
                    : 'bg-surface-2 text-ink-2 border-line-2 hover:border-line-1',
                ].join(' ')}
              >
                {child.pupil_name}
              </button>
            ))}
          </div>
        )}

        {activeChild && (
          <div className="space-y-s-6">
            {/* ── SECTION A: TTA Learning (always visible) ── */}
            <SectionHeader
              eyebrow="TTA Learning"
              title={activeChild.pupil_name}
              subtitle={formatLevel(activeChild.level)}
              badge="Your subscription"
            />

            {/* Stats band */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-s-4">
              <StatCard
                label="Streak"
                value={activeChild.current_streak === 0
                  ? '—'
                  : `🔥 ${activeChild.current_streak}`}
                sub={activeChild.longest_streak > 0
                  ? `Best: ${activeChild.longest_streak} days`
                  : 'Start today'}
              />
              <StatCard
                label="Lessons done"
                value={activeChild.lessons_completed ?? 0}
                sub={activeChild.lessons_in_progress > 0
                  ? `${activeChild.lessons_in_progress} in progress`
                  : 'Keep going'}
              />
              <StatCard
                label="Avg score"
                value={activeChild.avg_score != null
                  ? `${activeChild.avg_score}%`
                  : '—'}
                sub="On TTA quizzes"
                intent={scoreIntent(activeChild.avg_score)}
              />
              <StatCard
                label="Badges"
                value={activeChild.badges_earned ?? 0}
                sub="Earned"
              />
            </div>

            {/* Recent lessons + badges */}
            <div className="grid md:grid-cols-2 gap-s-5">
              <RecentLessonsCard pupilId={activeChild.pupil_id} />
              <BadgesCard pupilId={activeChild.pupil_id} />
            </div>

            {/* ── SECTION B: School Data (gated on connection) ── */}
            <SchoolDataSection
              pupilId={activeChild.pupil_id}
              pupilName={activeChild.pupil_name}
              connections={connections}
            />
          </div>
        )}
      </div>
    </AppShell>
  );
}

// ── Recent lessons card ───────────────────────────────────────────────────────

function RecentLessonsCard({ pupilId }) {
  const { data } = useQuery({
    queryKey:  ['parent', 'recent-lessons', pupilId],
    queryFn:   () => studentService.getLessonHistory(pupilId, { page: 1, pageSize: 5 }),
    staleTime: 60_000,
  });

  const lessons = data?.lessons ?? [];

  return (
    <Card className="bg-surface-2 border-line-2">
      <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-4">
        Recent lessons
      </div>
      {lessons.length === 0 ? (
        <p className="text-body text-ink-3">No lessons completed yet.</p>
      ) : (
        <div className="space-y-s-3">
          {lessons.map(({ lessons: lesson, last_score, completed_at }) => (
            <div key={lesson.id}
              className="flex items-center gap-s-3 py-s-2 border-b border-line-2 last:border-0">
              <div className="flex-1 min-w-0">
                <div className="text-[13.5px] text-ink-0 truncate">{lesson.title}</div>
                <div className="font-mono text-meta text-ink-3">
                  {lesson.subject}
                  {completed_at && (
                    <> · {new Date(completed_at).toLocaleDateString('en-NG', {
                      day: 'numeric', month: 'short',
                    })}</>
                  )}
                </div>
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
          ))}
        </div>
      )}
      <Link to="/app/parent/lessons" className="mt-s-4 block">
        <span className="font-mono text-meta text-gold-400 hover:underline">
          See full lesson library →
        </span>
      </Link>
    </Card>
  );
}

// ── Badges card ───────────────────────────────────────────────────────────────

function BadgesCard({ pupilId }) {
  const { data: badges } = useQuery({
    queryKey:  ['parent', 'badges', pupilId],
    queryFn:   () => studentService.getBadges(pupilId),
    staleTime: 60_000,
  });

  const earned = badges?.earned ?? [];

  return (
    <Card className="bg-surface-2 border-line-2">
      <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-4">
        Badges earned
      </div>
      {earned.length === 0 ? (
        <p className="text-body text-ink-3">No badges yet — encourage them!</p>
      ) : (
        <div className="grid grid-cols-2 gap-s-3">
          {earned.slice(0, 4).map((badge) => (
            <div key={badge.id}
              className="flex items-center gap-s-2 bg-surface-3 border border-line-2 rounded-r-2 px-s-3 py-s-2">
              <span className="text-[20px]">{badge.icon_emoji}</span>
              <div className="min-w-0">
                <div className="text-[12px] text-ink-0 truncate">{badge.name}</div>
                <div className="font-mono text-[10px] text-gold-400">
                  {new Date(badge.earnedAt).toLocaleDateString('en-NG', {
                    day: 'numeric', month: 'short',
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {earned.length > 4 && (
        <p className="mt-s-3 font-mono text-meta text-ink-3">
          +{earned.length - 4} more badges earned
        </p>
      )}
    </Card>
  );
}

// ── School data section ───────────────────────────────────────────────────────

function SchoolDataSection({ pupilId, pupilName, connections }) {
  const conn = connections?.find(
    (c) => c.pupils?.id === pupilId && c.status === 'approved',
  );

  const pendingConn = connections?.find(
    (c) => c.status === 'pending' &&
      (!c.pupils || c.pupils?.id === pupilId),
  );

  return (
    <div className="border-t border-line-1 pt-s-6">
      <SectionHeader
        eyebrow="School data"
        title="School performance"
        subtitle={conn ? conn.schools?.name : 'Not connected'}
        badge={conn ? 'School connected' : undefined}
      />

      {/* No connection at all */}
      {!conn && !pendingConn && (
        <Card className="bg-surface-2 border-line-2">
          <div className="flex flex-col sm:flex-row gap-s-5 items-start">
            <div className="flex-1">
              <h4 className="font-display text-[16px] text-ink-0 mb-s-2">
                Connect {pupilName.split(' ')[0]} to their school
              </h4>
              <p className="text-[13.5px] text-ink-2 leading-relaxed">
                Once connected and approved by the school, you can see attendance
                summaries, published term report cards, and subject score averages
                — directly in TTA.
              </p>
            </div>
            <Link to="/app/parent/children">
              <Button intent="ghost" size="sm">Connect school →</Button>
            </Link>
          </div>
        </Card>
      )}

      {/* Pending connection */}
      {pendingConn && !conn && (
        <Card className="bg-surface-2 border-amber-400/20">
          <div className="flex items-center gap-s-3">
            <Chip variant="amber" dot>Pending</Chip>
            <span className="text-body text-ink-2">
              Your connection request to {pendingConn.schools?.name ?? 'the school'} is
              awaiting their review. You'll be notified when approved.
            </span>
          </div>
        </Card>
      )}

      {/* Connected — show what's shared */}
      {conn && (
        <div className="grid sm:grid-cols-2 gap-s-4">
          {conn.share_attendance && (
            <AttendanceSummaryCard pupilId={pupilId} />
          )}
          {conn.share_score_summary && (
            <ScoreSummaryCard pupilId={pupilId} />
          )}
          {conn.share_term_reports && (
            <Card className="bg-surface-2 border-line-2">
              <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-3">
                Term reports
              </div>
              <p className="text-[13.5px] text-ink-2 mb-s-3">
                Published report cards appear in the Reports tab.
              </p>
              <Link to="/app/parent/reports">
                <Button intent="ghost" size="sm">View reports →</Button>
              </Link>
            </Card>
          )}
          {!conn.share_attendance && !conn.share_score_summary && !conn.share_term_reports && (
            <Card className="bg-surface-2 border-line-2 sm:col-span-2">
              <p className="text-[13.5px] text-ink-2">
                Connected to {conn.schools?.name}, but the school has not enabled
                any data sharing yet. Contact the school admin to request access.
              </p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function AttendanceSummaryCard({ pupilId }) {
  const { data: attendance } = useQuery({
    queryKey:  ['parent', 'attendance', pupilId],
    queryFn:   () => schoolConnectionService.getApprovedAttendance(pupilId),
    staleTime: 60 * 60_000,
  });

  const recent = attendance?.slice(0, 4) ?? [];

  return (
    <Card className="bg-surface-2 border-line-2">
      <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-3">
        Attendance
      </div>
      {recent.length === 0 ? (
        <p className="text-[13.5px] text-ink-3">No attendance data yet.</p>
      ) : (
        <div className="space-y-s-2">
          {recent.map((week) => {
            const total = week.present_count + week.absent_count + week.late_count;
            const pct   = total > 0
              ? Math.round((week.present_count / total) * 100)
              : 0;
            return (
              <div key={week.week_start}
                className="flex items-center justify-between py-s-1 border-b border-line-2 last:border-0">
                <span className="font-mono text-meta text-ink-3">
                  w/c {new Date(week.week_start).toLocaleDateString('en-NG', {
                    day: 'numeric', month: 'short',
                  })}
                </span>
                <div className="flex items-center gap-s-2">
                  <span className="text-[13.5px] text-ink-0">
                    {week.present_count}/{total} days
                  </span>
                  <Chip
                    variant={pct >= 90 ? 'green' : pct >= 70 ? 'gold' : 'default'}
                    size="sm"
                  >
                    {pct}%
                  </Chip>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function ScoreSummaryCard({ pupilId }) {
  const { data: scores } = useQuery({
    queryKey:  ['parent', 'scores', pupilId],
    queryFn:   () => schoolConnectionService.getApprovedScores(pupilId),
    staleTime: 60 * 60_000,
  });

  return (
    <Card className="bg-surface-2 border-line-2">
      <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-3">
        School scores
      </div>
      {(scores ?? []).length === 0 ? (
        <p className="text-[13.5px] text-ink-3">No assessment data yet.</p>
      ) : (
        <div className="space-y-s-2">
          {scores.map((row) => (
            <div key={row.class_id}
              className="flex items-center justify-between py-s-1 border-b border-line-2 last:border-0">
              <span className="text-[13.5px] text-ink-1 truncate mr-s-2">
                {row.assessment_count} assessment{row.assessment_count !== 1 ? 's' : ''}
              </span>
              <Chip
                variant={
                  row.avg_score_pct >= 80 ? 'green'
                  : row.avg_score_pct >= 60 ? 'gold'
                  : 'default'
                }
                size="sm"
              >
                {row.avg_score_pct}% avg
              </Chip>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function SectionHeader({ eyebrow, title, subtitle, badge }) {
  return (
    <div className="flex items-center gap-s-4 mb-s-4 flex-wrap">
      <div>
        <div className="font-mono text-eyebrow uppercase text-gold-400">{eyebrow}</div>
        <h3 className="mt-s-1 font-display text-display-3 text-ink-0">{title}</h3>
        {subtitle && (
          <div className="font-mono text-meta text-ink-3 mt-s-1">{subtitle}</div>
        )}
      </div>
      {badge && <Chip variant="default" size="sm">{badge}</Chip>}
    </div>
  );
}

function StatCard({ label, value, sub, intent = 'neutral' }) {
  const valueColor = intent === 'green' ? 'text-green-400'
    : intent === 'amber' ? 'text-amber-400'
    : 'text-ink-0';

  return (
    <Card className="bg-surface-2 border-line-2">
      <div className="font-mono text-eyebrow uppercase text-gold-400">{label}</div>
      <div className={`mt-s-3 font-display text-[28px] leading-none ${valueColor}`}>
        {value}
      </div>
      {sub && (
        <div className="mt-s-2 font-mono text-meta text-ink-3">{sub}</div>
      )}
    </Card>
  );
}

function ProgressSkeleton() {
  return (
    <div className="space-y-s-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-s-4">
        {[1,2,3,4].map((i) => (
          <div key={i} className="h-[90px] bg-surface-2 border border-line-1 rounded-r-3 animate-pulse" />
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-s-5">
        <div className="h-[200px] bg-surface-2 border border-line-1 rounded-r-3 animate-pulse" />
        <div className="h-[200px] bg-surface-2 border border-line-1 rounded-r-3 animate-pulse" />
      </div>
    </div>
  );
}

function formatLevel(level) {
  if (!level) return '';
  return level.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function scoreIntent(score) {
  if (score == null) return 'neutral';
  if (score >= 80)  return 'green';
  if (score >= 60)  return 'amber';
  return 'neutral';
}
