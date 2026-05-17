/**
 * src/modules/parent/ParentApp.jsx
 *
 * The parent dashboard. Designed around the research insight: parents are
 * paralysed by detail, not under-served. Surface a small number of large,
 * confident things — never an inbox of metrics.
 */

import { Routes, Route, Link } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { getGreeting } from '@/utils/greeting';
import { TonightView } from './TonightView'; // Imported externally
import { ParentReportsView } from './ParentReportsView';
import { ProgressView }   from './ProgressView';
import { ParentSubscribeView } from './ParentSubscribeView';
import { LessonReaderView } from './LessonReaderView';
import { LessonPrintView } from './LessonPrintView';
import { ChildEnrolmentView } from './ChildEnrolmentView';
import { ReportCardPrint } from '@/modules/sims/ReportCardPrint';

const NAV = [
  { to: '/app/parent', label: 'Tonight', end: true },
  { to: '/app/parent/children', label: 'Children' },
  { to: '/app/parent/lessons', label: 'Lessons' },
  { to: '/app/parent/progress', label: 'Progress' },
  { to: '/app/parent/reports', label: 'Reports' },
  { to: '/app/parent/subscribe', label: 'Subscribe' },
];

export default function ParentApp() {
  return (
    <Routes>
      <Route index element={<TonightView />} />
      <Route path="progress" element={<ProgressView />} />
      <Route path="children" element={<ChildrenShell><ChildEnrolmentView /></ChildrenShell>} />
      <Route path="lessons/:lessonId/print" element={<LessonPrintView />} />
      <Route path="lessons/:lessonId" element={<LessonShell><LessonReaderView /></LessonShell>} />
      <Route path="reports" element={<ReportsShell><ParentReportsView /></ReportsShell>} />
      <Route path="reports/:pupilId/:term/:year/print" element={<ReportCardPrint />} />
      <Route path="subscribe" element={<SubscribeShell><ParentSubscribeView /></SubscribeShell>} />
    </Routes>
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
