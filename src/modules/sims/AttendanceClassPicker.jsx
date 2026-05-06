/**
 * src/modules/sims/AttendanceClassPicker.jsx
 *
 * Lands on /app/teacher/attendance. Shows the teacher's classes with the
 * pupil count and an entry button. Tapping a class navigates to the
 * register screen.
 *
 * For most teachers there are 1–3 classes — we don't paginate, search, or
 * filter. If a teacher had 20 classes (head of department territory), we'd
 * add a search box, but premature optimisation here makes the screen
 * harder to use for the 90% case.
 */

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { useAuth } from '@/hooks/useAuth';
import * as simsService from '@/services/simsService';

export function AttendanceClassPicker() {
  const { user } = useAuth();
  const today = new Date();
  const dateLabel = today.toLocaleDateString('en-NG', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  const { data: classes, isLoading, error } = useQuery({
    queryKey: ['teacher', 'classes'],
    queryFn: () => simsService.getMyClasses(),
    enabled: !!user?.id,
    staleTime: 5 * 60_000, // 5 min — class lists don't change mid-day
  });

  return (
    <div className="max-w-[820px]">
      <div className="mb-s-7">
        <div className="font-mono text-eyebrow uppercase text-gold-400">{dateLabel}</div>
        <h2 className="mt-s-3 font-display text-display-2 text-ink-0">
          Take attendance.
        </h2>
        <p className="mt-s-3 text-body text-ink-2 max-w-[58ch]">
          Pick a class to open today's register. You can take attendance for
          any class whose teacher you are.
        </p>
      </div>

      {isLoading && <SkeletonList />}

      {error && (
        <Card className="border-red-400/30 bg-red-400/[0.04]">
          <div className="font-display text-display-3 text-red-400">Could not load classes</div>
          <p className="mt-s-3 text-body text-ink-2">{error.message}</p>
        </Card>
      )}

      {classes?.length === 0 && (
        <Card>
          <div className="font-display text-display-3 text-ink-0">No classes yet.</div>
          <p className="mt-s-3 text-body text-ink-2">
            Your school administrator hasn't assigned you to any classes.
            Once they do, your classes will appear here.
          </p>
        </Card>
      )}

      {classes?.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-s-4">
          {classes.map((cls) => (
            <ClassCard key={cls.id} cls={cls} />
          ))}
        </div>
      )}
    </div>
  );
}

function ClassCard({ cls }) {
  return (
    <Link
      to={`/app/teacher/attendance/${cls.id}`}
      className="group bg-surface-2 border border-line-1 rounded-r-3 p-s-6 hover:border-gold-400/40 hover:bg-surface-3 transition-all duration-150 flex flex-col gap-s-4"
    >
      <div className="flex items-start justify-between gap-s-4">
        <div className="min-w-0">
          <div className="font-mono text-eyebrow uppercase text-gold-400">{cls.level}</div>
          <h3 className="mt-s-2 font-display text-display-3 text-ink-0 truncate">{cls.name}</h3>
        </div>
        <Chip variant="default">{cls.pupil_count} pupils</Chip>
      </div>
      <div className="mt-auto pt-s-3 border-t border-line-1 flex items-center justify-between">
        <span className="font-mono text-meta text-ink-3">Tap to open register</span>
        <span className="text-gold-200 group-hover:text-gold-50 transition-colors">→</span>
      </div>
    </Link>
  );
}

function SkeletonList() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-s-4">
      {[0, 1].map((i) => (
        <div key={i} className="bg-surface-2 border border-line-1 rounded-r-3 p-s-6 h-[140px] animate-pulse">
          <div className="h-[10px] w-[80px] bg-surface-3 rounded" />
          <div className="mt-s-4 h-[20px] w-[180px] bg-surface-3 rounded" />
          <div className="mt-s-7 h-[14px] w-[120px] bg-surface-3 rounded" />
        </div>
      ))}
    </div>
  );
}
