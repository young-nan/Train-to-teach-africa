/**
 * src/modules/sims/TeacherApp.jsx
 *
 * The teacher dashboard. The Design Documentation specifies four "Giant
 * Actions" — Mark Attendance, Log Lesson, Enter Scores, Generate Report —
 * each reachable in under 5 seconds. Everything else is secondary.
 *
 * The teacher's day starts here, every day.
 */

import { Routes, Route, Link } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { Card, KpiCard } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { useAuth } from '@/hooks/useAuth';

const NAV = [
  { to: '/app/teacher', label: 'Today', end: true },
  { to: '/app/teacher/attendance', label: 'Attendance' },
  { to: '/app/teacher/lessons', label: 'Lessons' },
  { to: '/app/teacher/scores', label: 'Scores' },
  { to: '/app/teacher/reports', label: 'Reports' },
];

export default function TeacherApp() {
  return (
    <Routes>
      <Route index element={<TodayView />} />
      <Route path="attendance" element={<Placeholder title="Attendance" />} />
      <Route path="lessons" element={<Placeholder title="Lessons" />} />
      <Route path="scores" element={<Placeholder title="Scores" />} />
      <Route path="reports" element={<Placeholder title="Reports" />} />
    </Routes>
  );
}

function TodayView() {
  const { profile } = useAuth();
  const firstName = profile?.full_name?.split(' ')[0] ?? 'Teacher';
  const now = new Date();
  const dateLabel = now.toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <AppShell title="Today" navItems={NAV}>
      <div className="max-w-[1100px]">
        {/* Greeting band */}
        <div className="mb-s-7">
          <div className="font-mono text-eyebrow uppercase text-gold-400">{dateLabel}</div>
          <h2 className="mt-s-3 font-display text-display-2 text-ink-0">
            Good morning, <span className="ital-gold">{firstName}.</span>
          </h2>
          <p className="mt-s-3 text-body text-ink-2 max-w-[60ch]">
            Two classes today. Attendance for Primary 3 Emerald is the first
            thing on your morning. Everything else can wait.
          </p>
        </div>

        {/* The Four Giant Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-s-5">
          <GiantAction
            to="/app/teacher/attendance"
            number="01"
            title="Mark attendance"
            body="Primary 3 Emerald — 28 pupils"
            cta="Open register →"
            estimate="≈ 90 seconds"
          />
          <GiantAction
            to="/app/teacher/lessons"
            number="02"
            title="Log today's lesson"
            body="Maths · Fractions of a whole"
            cta="Open lesson →"
            estimate="≈ 30 minutes"
          />
          <GiantAction
            to="/app/teacher/scores"
            number="03"
            title="Enter scores"
            body="Friday's quiz · 28 pupils awaiting"
            cta="Open scoresheet →"
            estimate="≈ 4 minutes"
          />
          <GiantAction
            to="/app/teacher/reports"
            number="04"
            title="Generate term report"
            body="Term 2 reports · drafts ready"
            cta="Open reports →"
            estimate="≈ 2 minutes"
          />
        </div>

        {/* KPI strip */}
        <div className="mt-s-9">
          <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-4">This week at a glance</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-s-4">
            <KpiCard label="Attendance avg" value="92%" trend="▲ 1.2 pts" trendIntent="green" />
            <KpiCard label="Lessons logged" value="11/14" trend="3 left" trendIntent="amber" />
            <KpiCard label="Scores entered" value="84%" trend="▲ vs last week" trendIntent="green" />
            <KpiCard label="At-risk pupils" value="3" trend="See list →" trendIntent="red" />
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function GiantAction({ to, number, title, body, cta, estimate }) {
  return (
    <Link
      to={to}
      className="group bg-surface-2 border border-line-1 rounded-r-3 p-s-7 hover:border-gold-400/40 hover:bg-surface-3 transition-all duration-150 flex flex-col gap-s-4"
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-eyebrow uppercase text-gold-400">{number}</span>
        <Chip variant="default">{estimate}</Chip>
      </div>
      <div>
        <h3 className="font-display text-display-3 text-ink-0">{title}</h3>
        <p className="mt-s-2 text-body text-ink-2">{body}</p>
      </div>
      <div className="mt-auto pt-s-4 border-t border-line-1">
        <span className="text-[13.5px] text-gold-200 group-hover:text-gold-50">{cta}</span>
      </div>
    </Link>
  );
}

function Placeholder({ title }) {
  return (
    <AppShell title={title} navItems={NAV}>
      <Card>
        <div className="font-display text-display-3 text-ink-0">{title}</div>
        <p className="mt-s-3 text-body text-ink-2">
          This view is part of the production build that follows the patterns
          established in the Today view.
        </p>
      </Card>
    </AppShell>
  );
}
