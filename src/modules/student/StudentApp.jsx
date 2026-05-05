/**
 * src/modules/student/StudentApp.jsx
 *
 * The student dashboard. Children. Shared devices. Short attention.
 * The whole surface should be one decision wide: what do I do next?
 */

import { Routes, Route } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Card } from '@/components/ui/Card';

const NAV = [
  { to: '/app/student', label: 'Today', end: true },
  { to: '/app/student/library', label: 'Lessons' },
  { to: '/app/student/badges', label: 'Badges' },
];

export default function StudentApp() {
  return (
    <Routes>
      <Route index element={<TodayView />} />
      <Route path="library" element={<Placeholder title="Lesson library" />} />
      <Route path="badges" element={<Placeholder title="Badges" />} />
    </Routes>
  );
}

function TodayView() {
  return (
    <AppShell title="Today" navItems={NAV}>
      <div className="max-w-[680px]">
        {/* Streak + greeting */}
        <div className="mb-s-7 flex items-center gap-s-4">
          <Chip variant="gold" dot>5-day streak</Chip>
          <Chip variant="default">12 lessons done</Chip>
        </div>

        {/* The next lesson — one big card, one big button */}
        <div className="bg-surface-2 border border-gold-400/40 rounded-r-4 p-s-9 shadow-gold mb-s-5">
          <div className="font-mono text-eyebrow uppercase text-gold-400">Next up</div>
          <h2 className="mt-s-4 font-display text-[40px] leading-tight text-ink-0">
            Fractions of a whole.
          </h2>
          <p className="mt-s-3 text-body-l text-ink-2">
            Maths · Primary 3 · 12 minutes.
          </p>
          <div className="mt-s-7">
            <Button intent="primary" size="lg">Start lesson →</Button>
          </div>
        </div>

        {/* Recent achievements */}
        <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-4">Just done</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-s-4">
          <Card className="bg-surface-2">
            <div className="font-display text-display-3 text-ink-0">Times tables</div>
            <div className="mt-s-2 font-mono text-meta text-ink-3">Maths · 88%</div>
          </Card>
          <Card className="bg-surface-2">
            <div className="font-display text-display-3 text-ink-0">Reading comprehension</div>
            <div className="mt-s-2 font-mono text-meta text-ink-3">English · 92%</div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function Placeholder({ title }) {
  return (
    <AppShell title={title} navItems={NAV}>
      <Card><div className="font-display text-display-3 text-ink-0">{title}</div></Card>
    </AppShell>
  );
}
