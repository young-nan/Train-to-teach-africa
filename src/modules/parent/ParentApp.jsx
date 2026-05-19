/**
 * src/modules/parent/ParentApp.jsx
 *
 * The parent dashboard. Designed around the research insight: parents are
 * paralysed by detail, not under-served. Surface a small number of large,
 * confident things — never an inbox of metrics.
 */

import { useState } from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { UpNextCard } from '@/components/ui/UpNextCard';
import { useAuth } from '@/hooks/useAuth';
import { getGreeting } from '@/utils/greeting';
import { ParentReportsView } from './ParentReportsView';
import { ParentSubscribeView } from './ParentSubscribeView';
import { LessonReaderView } from './LessonReaderView';
import { LessonPrintView } from './LessonPrintView';
import { ChildEnrolmentView } from './ChildEnrolmentView';
import { ReportCardPrint } from '@/modules/sims/ReportCardPrint';
import { ParentBillingView } from '@/modules/billing/ParentBillingView';
import { ParentCommsView } from './ParentCommsView';
import { WhatsAppOptInView } from './WhatsAppOptInView';
import { ParentLessonLibrary } from './ParentLessonLibrary';
import { ParentTutorSearchView } from '@/modules/marketplace/ParentTutorSearchView';
import * as simsService from '@/services/simsService';
import { supabase } from '@/lib/supabase';

import { PARENT_NAV as NAV } from './parentNav';

export default function ParentApp() {
  return (
    <Routes>
      <Route index element={<TonightView />} />
      <Route path="interventions" element={<InterventionsView />} />
      <Route path="children" element={<ChildrenShell><ChildEnrolmentView /></ChildrenShell>} />
      <Route path="lessons" element={<LessonsShell><ParentLessonLibrary /></LessonsShell>} />
      <Route path="lessons/:lessonId/print" element={<LessonPrintView />} />
      <Route path="lessons/:lessonId" element={<LessonShell><LessonReaderView /></LessonShell>} />
      <Route path="reports" element={<ReportsShell><ParentReportsView /></ReportsShell>} />
      <Route path="reports/:pupilId/:term/:year/print" element={<ReportCardPrint />} />
      <Route path="tutors"    element={<ParentTutorSearchView />} />
      <Route path="messages"  element={<ParentCommsView />} />
      <Route path="billing"   element={<ParentBillingView />} />
      <Route path="whatsapp"  element={<WhatsAppShell><WhatsAppOptInView /></WhatsAppShell>} />
      <Route path="subscribe" element={<SubscribeShell><ParentSubscribeView /></SubscribeShell>} />
    </Routes>
  );
}

function TonightView() {
  const { profile } = useAuth();
  const navigate    = useNavigate();
  const firstName   = profile?.full_name?.split(' ')[0] ?? 'There';

  const { data: children } = useQuery({
    queryKey: ['parent', 'children'],
    queryFn:  () => simsService.getMyChildren(),
    staleTime: 300_000,
  });

  // Multi-child tab state
  const [activeChildIdx, setActiveChildIdx] = useState(0);
  const activeChild = children?.[activeChildIdx] ?? children?.[0];

  // Tonight's lesson for active child
  const { data: lesson, isLoading: lessonLoading } = useQuery({
    queryKey: ['parent', 'tonight-lesson', activeChild?.id],
    queryFn: async () => {
      if (!activeChild?.level) return null;
      const month = new Date().getMonth() + 1;
      const weekOfTerm = month >= 9 ? 8 : month <= 3 ? 4 : 4;
      const { data, error } = await supabase
        .from('lessons')
        .select('id, title, subject, topic, level, estimated_minutes, content, sort_index, week_of_term')
        .eq('level', activeChild.level)
        .eq('status', 'published')
        .order('sort_index', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!activeChild?.level,
    staleTime: 60_000,
  });

  // Attendance this week for active child
  const { data: weekAttendance } = useQuery({
    queryKey: ['parent', 'week-attendance', activeChild?.id],
    queryFn: async () => {
      if (!activeChild?.id) return null;
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const { data } = await supabase
        .from('attendance')
        .select('status, date')
        .eq('pupil_id', activeChild.id)
        .gte('date', weekAgo)
        .order('date', { ascending: false });
      return data ?? [];
    },
    enabled: !!activeChild?.id,
    staleTime: 300_000,
  });

  const presentDays = weekAttendance?.filter((r) => r.status === 'present').length ?? 0;
  const totalDays   = weekAttendance?.length ?? 0;

  // Extract dinner questions and kitchen activity from lesson content
  const layers = lesson?.content?.layers ?? {};
  const dinnerQs = layers.parentDinnerQuestions ?? layers.parent_dinner_questions ?? [];
  const kitchenActivity = layers.parentKitchenActivity ?? layers.parent_kitchen_activity ?? '';

  const shapedLesson = lesson ? {
    title:            lesson.title,
    subject:          lesson.subject,
    topic:            lesson.topic,
    level:            lesson.level,
    estimatedMinutes: lesson.estimated_minutes ?? 5,
    kitchenActivity,
  } : null;

  return (
    <AppShell title="Tonight" navItems={NAV}>
      <div className="max-w-[820px]">

        {/* Greeting */}
        <div className="mb-s-6">
          <div className="font-mono text-eyebrow uppercase text-gold-400">
            Tonight's home support
          </div>
          <h2 className="mt-s-3 font-display text-display-2 text-ink-0">
            {getGreeting()}, <span className="ital-gold">{firstName}.</span>
          </h2>
        </div>

        {/* Multi-child tabs */}
        {children && children.length > 1 && (
          <div className="flex flex-wrap gap-s-2 mb-s-5">
            {children.map((child, idx) => (
              <button
                key={child.id}
                onClick={() => setActiveChildIdx(idx)}
                className={[
                  'flex items-center gap-s-2 px-s-4 py-s-2 rounded-full border transition-all text-[13px]',
                  idx === activeChildIdx
                    ? 'bg-gold-400/15 border-gold-400/40 text-gold-200'
                    : 'bg-surface-2 border-line-2 text-ink-2 hover:border-line-3',
                ].join(' ')}
              >
                <span className="w-[20px] h-[20px] rounded-full bg-surface-3 grid place-items-center font-mono text-[10px]">
                  {child.full_name?.[0]?.toUpperCase()}
                </span>
                {child.full_name?.split(' ')[0]}
              </button>
            ))}
          </div>
        )}

        {/* Hero UpNextCard */}
        <div className="mb-s-6">
          <UpNextCard
            lesson={shapedLesson}
            childName={activeChild?.full_name}
            variant="parent"
            isLoading={lessonLoading}
            onStart={() => lesson && navigate(`/app/parent/lessons/${lesson.id}`)}
          />
        </div>

        {/* Dinner questions — the centrepiece of family engagement */}
        {dinnerQs.length > 0 && (
          <Card className="bg-surface-2 border-gold-400/20 mb-s-5">
            <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-4">
              🍽 Dinner table questions
            </div>
            <div className="space-y-s-3">
              {dinnerQs.map((q, i) => (
                <div key={i} className="flex gap-s-3">
                  <span className="font-mono text-[13px] text-gold-400 shrink-0 mt-[2px]">{i + 1}.</span>
                  <p className="text-[15px] text-ink-1 leading-relaxed">{q}</p>
                </div>
              ))}
            </div>
            {kitchenActivity && (
              <div className="mt-s-5 pt-s-4 border-t border-line-1">
                <div className="font-mono text-eyebrow uppercase text-ink-3 mb-s-2">🥘 Kitchen activity</div>
                <p className="text-[14px] text-ink-2 leading-relaxed">{kitchenActivity}</p>
              </div>
            )}
          </Card>
        )}

        {/* Stats strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-s-4">
          <Card className="bg-surface-2">
            <div className="font-mono text-eyebrow uppercase text-gold-400">This week</div>
            <div className="mt-s-3 font-display text-[28px] text-ink-0 leading-none">
              {totalDays > 0 ? `${presentDays}/${totalDays}` : '—'}
            </div>
            <div className="mt-s-2 font-mono text-meta text-ink-3">days at school</div>
            {totalDays > 0 && presentDays < totalDays && (
              <Link to="/app/parent/interventions" className="mt-s-3 inline-block">
                <Button intent="ghost" size="sm">View absences →</Button>
              </Link>
            )}
          </Card>

          <Card className="bg-surface-2">
            <div className="font-mono text-eyebrow uppercase text-gold-400">Reports</div>
            <div className="mt-s-3 font-display text-[18px] text-ink-0 leading-tight">
              {activeChild ? `${activeChild.full_name?.split(' ')[0]}'s reports` : 'Reports'}
            </div>
            <Link to="/app/parent/reports" className="mt-s-3 inline-block">
              <Button intent="ghost" size="sm">View →</Button>
            </Link>
          </Card>

          <Card className="bg-surface-2">
            <div className="font-mono text-eyebrow uppercase text-gold-400">Interventions</div>
            <div className="mt-s-3 font-display text-[18px] text-ink-0 leading-tight">
              Alerts &amp; follow-ups
            </div>
            <Link to="/app/parent/interventions" className="mt-s-3 inline-block">
              <Button intent="ghost" size="sm">View →</Button>
            </Link>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

// ── Interventions view ────────────────────────────────────────────────────────
// Shows absence streaks, stalled reports, and teacher notes for the parent's
// children. Data comes from the same sources teachers see — just the parent
// slice. This is the "teacher has a concern" surface for parents.

function InterventionsView() {
  const { data: children } = useQuery({
    queryKey: ['parent', 'children'],
    queryFn:  () => simsService.getMyChildren(),
    staleTime: 300_000,
  });

  return (
    <AppShell title="Interventions" navItems={NAV}>
      <div className="max-w-[820px]">
        <div className="mb-s-7">
          <div className="font-mono text-eyebrow uppercase text-gold-400">Interventions</div>
          <h2 className="mt-s-3 font-display text-display-2 text-ink-0">
            Alerts &amp; follow-ups.
          </h2>
          <p className="mt-s-3 text-body text-ink-2 max-w-[58ch]">
            Attendance streaks, teacher messages, and anything that needs your
            attention. These come directly from your child's school.
          </p>
        </div>

        {!children || children.length === 0 ? (
          <Card className="bg-surface-2">
            <p className="text-body text-ink-2">
              No children linked yet.{' '}
              <Link to="/app/parent/children" className="text-gold-200 hover:text-gold-50">
                Connect a child to a school →
              </Link>
            </p>
          </Card>
        ) : (
          <div className="space-y-s-7">
            {children.map((child) => (
              <ChildInterventions key={child.id} child={child} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function ChildInterventions({ child }) {
  // Recent attendance (last 14 days)
  const { data: attendance } = useQuery({
    queryKey: ['parent', 'attendance', child.id],
    queryFn: async () => {
      const since = new Date(Date.now() - 14 * 86400_000).toISOString().slice(0, 10);
      const { data } = await supabase
        .from('attendance')
        .select('date, status, note')
        .eq('pupil_id', child.id)
        .gte('date', since)
        .order('date', { ascending: false });
      return data ?? [];
    },
    staleTime: 300_000,
  });

  // Shared teacher comms (notes shared_with_parent = true)
  const { data: comms } = useQuery({
    queryKey: ['parent', 'comms', child.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('parent_comms')
        .select('id, contact_type, body, created_at')
        .eq('pupil_id', child.id)
        .eq('shared_with_parent', true)
        .order('created_at', { ascending: false })
        .limit(5);
      return data ?? [];
    },
    staleTime: 300_000,
  });

  const absences  = attendance?.filter((r) => r.status === 'absent') ?? [];
  const lates     = attendance?.filter((r) => r.status === 'late')   ?? [];
  const presented = attendance?.filter((r) => r.status === 'present').length ?? 0;
  const total     = attendance?.length ?? 0;

  // Detect streak (3+ consecutive absences/lates from the most recent records)
  const sorted   = [...(attendance ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  let streak = 0;
  for (const r of sorted) {
    if (r.status === 'absent' || r.status === 'late') streak++;
    else break;
  }

  const hasIssues = absences.length >= 2 || streak >= 3 || comms?.length > 0;

  return (
    <section>
      <div className="flex items-center gap-s-3 mb-s-4">
        <div className="w-[36px] h-[36px] rounded-full bg-gold-400/15 border border-gold-400/25 grid place-items-center font-mono text-[13px] text-gold-200">
          {child.full_name?.[0]?.toUpperCase()}
        </div>
        <div>
          <div className="text-[16px] font-medium text-ink-0">{child.full_name}</div>
          <div className="font-mono text-[11px] text-ink-3">{child.level?.replace('_', ' ')}</div>
        </div>
        {!hasIssues && (
          <Chip variant="green" size="sm" className="ml-auto">All good</Chip>
        )}
      </div>

      <div className="space-y-s-3">
        {/* Absence streak alert */}
        {streak >= 3 && (
          <div className="bg-red-400/10 border border-red-400/30 rounded-r-2 px-s-4 py-s-4 flex gap-s-4">
            <span className="text-[20px] shrink-0">⚠️</span>
            <div>
              <p className="text-[14px] font-medium text-red-300">
                {streak} consecutive absences or lates
              </p>
              <p className="text-[13px] text-ink-3 mt-s-1">
                {child.full_name?.split(' ')[0]} has missed or been late to school {streak} days in a row.
                Consider contacting the school if this continues.
              </p>
            </div>
          </div>
        )}

        {/* 14-day attendance summary */}
        {total > 0 && (
          <Card className="bg-surface-2">
            <div className="font-mono text-eyebrow uppercase text-ink-3 mb-s-3">Last 14 days</div>
            <div className="flex gap-s-4 mb-s-4">
              <div>
                <div className="font-display text-[24px] text-green-400">{presented}</div>
                <div className="font-mono text-meta text-ink-3">Present</div>
              </div>
              <div>
                <div className="font-display text-[24px] text-red-400">{absences.length}</div>
                <div className="font-mono text-meta text-ink-3">Absent</div>
              </div>
              <div>
                <div className="font-display text-[24px] text-amber-400">{lates.length}</div>
                <div className="font-mono text-meta text-ink-3">Late</div>
              </div>
            </div>
            {/* Day-by-day dots */}
            <div className="flex flex-wrap gap-[4px]">
              {sorted.map((r) => (
                <div
                  key={r.date}
                  title={`${r.date} — ${r.status}`}
                  className={[
                    'w-[22px] h-[22px] rounded-sm text-[9px] grid place-items-center font-mono',
                    r.status === 'present' ? 'bg-green-400/20 text-green-400'
                    : r.status === 'absent'  ? 'bg-red-400/20 text-red-400'
                    : 'bg-amber-400/20 text-amber-400',
                  ].join(' ')}
                >
                  {new Date(r.date + 'T00:00:00').getDate()}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Teacher messages */}
        {comms && comms.length > 0 && (
          <Card className="bg-surface-2">
            <div className="font-mono text-eyebrow uppercase text-ink-3 mb-s-3">Messages from school</div>
            <div className="space-y-s-3">
              {comms.map((c) => (
                <div key={c.id} className="border-l-2 border-gold-400/40 pl-s-3">
                  <p className="text-[13.5px] text-ink-1 leading-relaxed">{c.body}</p>
                  <p className="font-mono text-[11px] text-ink-4 mt-s-1">
                    {new Date(c.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                    {' · '}{c.contact_type}
                  </p>
                </div>
              ))}
            </div>
            <Link to="/app/parent/messages" className="mt-s-4 inline-block">
              <Button intent="ghost" size="sm">All messages →</Button>
            </Link>
          </Card>
        )}

        {!hasIssues && total === 0 && (
          <p className="text-[13px] text-ink-3 italic px-s-1">
            No attendance records yet for this child.
          </p>
        )}
      </div>
    </section>
  );
}



function ReportsShell({ children }) {
  return (
    <AppShell title="Reports" navItems={NAV}>
      {children}
    </AppShell>
  );
}

function MessagesShell({ children }) {
  return (
    <AppShell title="Messages" navItems={NAV}>
      {children}
    </AppShell>
  );
}

function WhatsAppShell({ children }) {
  return (
    <AppShell title="WhatsApp" navItems={NAV}>
      {children}
    </AppShell>
  );
}

function BillingShell({ children }) {
  return (
    <AppShell title="Fees" navItems={NAV}>
      {children}
    </AppShell>
  );
}

function SubscribeShell({ children }) {
  return (
    <AppShell title="Subscribe" navItems={NAV}>
      {children}
    </AppShell>
  );
}

function LessonsShell({ children }) {
  return <AppShell title="Lessons" navItems={NAV}>{children}</AppShell>;
}

function LessonShell({ children }) {
  return (
    <AppShell title="Lesson" navItems={NAV}>
      {children}
    </AppShell>
  );
}

function ChildrenShell({ children }) {
  return (
    <AppShell title="Children" navItems={NAV}>
      {children}
    </AppShell>
  );
}
