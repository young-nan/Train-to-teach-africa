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
import { ParentReportsView } from './ParentReportsView';
import { ParentSubscribeView } from './ParentSubscribeView';
import { LessonReaderView } from './LessonReaderView';
import { LessonPrintView } from './LessonPrintView';
import { ChildEnrolmentView } from './ChildEnrolmentView';
import { ReportCardPrint } from '@/modules/sims/ReportCardPrint';

const NAV = [
  { to: '/app/parent', label: 'Tonight', end: true },
  { to: '/app/parent/children', label: 'Children' },
  { to: '/app/parent/lessons', label: 'Lessons' },
  { to: '/app/parent/reports', label: 'Reports' },
  { to: '/app/parent/subscribe', label: 'Subscribe' },
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
      <Route path="subscribe" element={<SubscribeShell><ParentSubscribeView /></SubscribeShell>} />
    </Routes>
  );
}

function TonightView() {
  const { profile } = useAuth();
  const firstName = profile?.full_name?.split(' ')[0] ?? 'There';
  return (
    <AppShell title="Tonight" navItems={NAV}>
      <div className="max-w-[820px]">
        <div className="mb-s-7">
          <div className="font-mono text-eyebrow uppercase text-gold-400">Tonight's home support</div>
          <h2 className="mt-s-3 font-display text-display-2 text-ink-0">
            {getGreeting()}, <span className="ital-gold">{firstName}.</span>
          </h2>
        </div>

        {/* The hero card — what's tonight's home activity */}
        <Card className="bg-surface-2 border-line-2 mb-s-5">
          <div className="flex flex-wrap items-center gap-s-3 mb-s-4">
            <Chip variant="gold" dot>Adaeze · Primary 3</Chip>
            <Chip variant="default">Maths · Fractions</Chip>
          </div>
          <h3 className="font-display text-[28px] leading-tight text-ink-0">
            Adaeze is learning <span className="ital-gold">fractions</span> tonight.
          </h3>
          <p className="mt-s-4 text-body-l text-ink-2 max-w-[60ch]">
            A fraction is a piece of a whole. Today she learned to spot halves
            and quarters in everyday things.
          </p>

          <div className="mt-s-7 grid md:grid-cols-2 gap-s-5">
            <div className="bg-surface-3 border border-gold-400/30 rounded-r-2 p-s-5">
              <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-2">5-minute kitchen activity</div>
              <p className="text-body text-ink-1 leading-relaxed">
                Cut a pancake into halves, then quarters. Ask her to point to
                "two quarters" and "one half" — they're the same thing.
              </p>
            </div>
            <div className="bg-surface-3 border border-line-2 rounded-r-2 p-s-5">
              <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-2">3 dinner questions</div>
              <ul className="text-body text-ink-1 space-y-s-2 list-decimal list-inside">
                <li>How many halves make a whole?</li>
                <li>Show me a quarter using your fingers.</li>
                <li>Which is bigger — a half or a quarter?</li>
              </ul>
            </div>
          </div>
        </Card>

        {/* Quick child overview strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-s-4">
          <Card className="bg-surface-2">
            <div className="font-mono text-eyebrow uppercase text-gold-400">This week</div>
            <div className="mt-s-3 font-display text-[28px] text-ink-0 leading-none">4 / 5</div>
            <div className="mt-s-2 font-mono text-meta text-ink-3">days at school</div>
          </Card>
          <Card className="bg-surface-2">
            <div className="font-mono text-eyebrow uppercase text-gold-400">Last quiz</div>
            <div className="mt-s-3 font-display text-[28px] text-ink-0 leading-none">88%</div>
            <div className="mt-s-2 font-mono text-meta text-ink-3">Maths · fractions</div>
          </Card>
          <Card className="bg-surface-2">
            <div className="font-mono text-eyebrow uppercase text-gold-400">Term report</div>
            <div className="mt-s-3 font-display text-[18px] text-ink-0 leading-tight">Available 12 December</div>
            <Link to="/app/parent/reports" className="mt-s-3 inline-block">
              <Button intent="ghost" size="sm">See last term →</Button>
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
