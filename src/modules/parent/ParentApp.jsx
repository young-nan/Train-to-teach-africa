/**
 * src/modules/parent/ParentApp.jsx
 *
 * The parent dashboard. Designed around the research insight: parents are
 * paralysed by detail, not under-served. Surface a small number of large,
 * confident things — never an inbox of metrics.
 */

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
import * as simsService from '@/services/simsService';
import { supabase } from '@/lib/supabase';

const NAV = [
  { to: '/app/parent',           label: 'Tonight',   end: true },
  { to: '/app/parent/children',  label: 'Children'             },
  { to: '/app/parent/lessons',   label: 'Lessons'              },
  { to: '/app/parent/reports',   label: 'Reports'              },
  { to: '/app/parent/messages',  label: 'Messages'             },
  { to: '/app/parent/billing',   label: 'Fees'                 },
  { to: '/app/parent/whatsapp',  label: 'WhatsApp'             },
  { to: '/app/parent/subscribe', label: 'Subscribe'            },
];

export default function ParentApp() {
  return (
    <Routes>
      <Route index element={<TonightView />} />
      <Route path="children" element={<ChildrenShell><ChildEnrolmentView /></ChildrenShell>} />
      <Route path="lessons/:lessonId/print" element={<LessonPrintView />} />
      <Route path="lessons/:lessonId" element={<LessonShell><LessonReaderView /></LessonShell>} />
      <Route path="reports" element={<ReportsShell><ParentReportsView /></ReportsShell>} />
      <Route path="reports/:pupilId/:term/:year/print" element={<ReportCardPrint />} />
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

  // Load children
  const { data: children } = useQuery({
    queryKey: ['parent', 'children'],
    queryFn:  () => simsService.getMyChildren(),
    staleTime: 300_000,
  });

  // Pick the first child for the hero card
  const firstChild = children?.[0];

  // Fetch tonight's lesson for that child's level
  const { data: lesson, isLoading: lessonLoading } = useQuery({
    queryKey: ['parent', 'tonight-lesson', firstChild?.id],
    queryFn: async () => {
      if (!firstChild?.level) return null;
      // Week-of-term heuristic (matches the nightly digest logic)
      const month = new Date().getMonth() + 1;
      const weekOfTerm = month >= 9 ? 8 : month <= 3 ? 4 : 4; // mid-term fallback
      const { data, error } = await supabase
        .from('lessons')
        .select('id, title, subject, topic, level, estimated_minutes, content, sort_index, week_of_term')
        .eq('level', firstChild.level)
        .eq('status', 'published')
        .order('sort_index', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!firstChild?.level,
    staleTime: 60_000,
  });

  // Attendance for first child this week
  const { data: weekAttendance } = useQuery({
    queryKey: ['parent', 'week-attendance', firstChild?.id],
    queryFn: async () => {
      if (!firstChild?.id) return null;
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const { data } = await supabase
        .from('attendance')
        .select('status')
        .eq('pupil_id', firstChild.id)
        .gte('date', weekAgo);
      return data ?? [];
    },
    enabled: !!firstChild?.id,
    staleTime: 300_000,
  });

  const presentDays  = weekAttendance?.filter((r) => r.status === 'present').length ?? 0;
  const totalDays    = weekAttendance?.length ?? 5;

  // Shape lesson for UpNextCard
  const shapedLesson = lesson ? {
    title:             lesson.title,
    subject:           lesson.subject,
    topic:             lesson.topic,
    level:             lesson.level,
    estimatedMinutes:  lesson.estimated_minutes ?? 5,
    kitchenActivity:   lesson.content?.layers?.parentKitchenActivity
                    ?? lesson.content?.layers?.parent_kitchen_activity
                    ?? '',
  } : null;

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

        {/* Child tabs if multiple children */}
        {children && children.length > 1 && (
          <div className="flex flex-wrap gap-s-2 mb-s-5">
            {children.map((child) => (
              <div
                key={child.id}
                className="flex items-center gap-s-2 px-s-4 py-s-2 rounded-full bg-surface-2 border border-line-2"
              >
                <div className="w-[24px] h-[24px] rounded-full bg-gold-400/15 border border-gold-400/25 grid place-items-center font-mono text-[10px] text-gold-200">
                  {child.full_name?.[0]?.toUpperCase()}
                </div>
                <span className="text-[13px] text-ink-1">{child.full_name?.split(' ')[0]}</span>
                <span className="font-mono text-[10px] text-ink-3">{child.level}</span>
              </div>
            ))}
          </div>
        )}

        {/* Hero UpNextCard */}
        <div className="mb-s-6">
          <UpNextCard
            lesson={shapedLesson}
            childName={firstChild?.full_name}
            variant="parent"
            isLoading={lessonLoading}
            onStart={() => lesson && navigate(`/app/parent/lessons/${lesson.id}`)}
            onSave={() => {/* save-for-later in v2 */}}
          />
        </div>

        {/* Quick stats strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-s-4">
          <Card className="bg-surface-2">
            <div className="font-mono text-eyebrow uppercase text-gold-400">This week</div>
            <div className="mt-s-3 font-display text-[28px] text-ink-0 leading-none">
              {presentDays} / {totalDays}
            </div>
            <div className="mt-s-2 font-mono text-meta text-ink-3">days at school</div>
          </Card>

          <Card className="bg-surface-2">
            <div className="font-mono text-eyebrow uppercase text-gold-400">Children</div>
            <div className="mt-s-3 font-display text-[28px] text-ink-0 leading-none">
              {children?.length ?? '—'}
            </div>
            <Link to="/app/parent/children" className="mt-s-3 inline-block">
              <Button intent="ghost" size="sm">Manage →</Button>
            </Link>
          </Card>

          <Card className="bg-surface-2">
            <div className="font-mono text-eyebrow uppercase text-gold-400">Term report</div>
            <div className="mt-s-3 font-display text-[18px] text-ink-0 leading-tight">
              {firstChild ? `${firstChild.full_name?.split(' ')[0]}'s reports` : 'Reports'}
            </div>
            <Link to="/app/parent/reports" className="mt-s-3 inline-block">
              <Button intent="ghost" size="sm">View →</Button>
            </Link>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function Placeholder({ title }) {
  return (
    <AppShell title={title} navItems={NAV}>
      <Card>
        <div className="font-display text-display-3 text-ink-0">{title}</div>
        <p className="mt-s-3 text-body text-ink-2">Built from the same patterns as the Tonight view.</p>
      </Card>
    </AppShell>
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
