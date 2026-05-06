/**
 * src/modules/sims/AttendanceEntry.jsx
 *
 * The register screen. /app/teacher/attendance/:classId
 *
 * Layout (mobile-first):
 *   ┌─────────────────────────────────────────┐
 *   │  ← Back   Primary 3 Emerald · Tuesday   │  sticky header
 *   │  P 25  •  L 2  •  A 1                   │  live counts
 *   │  [Mark all present]                     │  bulk action
 *   ├─────────────────────────────────────────┤
 *   │  ▢ Adaeze Okafor          [P][L][A] [+] │  scrollable
 *   │  ▢ Bukola Adesanya        [P][L][A] [+] │  pupil list
 *   │  ...                                    │
 *   ├─────────────────────────────────────────┤
 *   │  [Save register]   3 changes pending    │  sticky save bar
 *   └─────────────────────────────────────────┘
 *
 * The sticky top + sticky bottom are critical at scale: 60-pupil class on
 * a 5" Tecno screen, the teacher must always see the counts and the save
 * button. Scrolling 4 thumb-flicks to find Save is unacceptable.
 */

import { useQuery } from '@tanstack/react-query';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAttendance } from '@/hooks/useAttendance';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Card } from '@/components/ui/Card';
import { PupilRow } from './components/PupilRow';
import * as simsService from '@/services/simsService';

export function AttendanceEntry() {
  const { classId } = useParams();
  const navigate = useNavigate();

  // Load the class metadata + pupil roster in parallel. Both are cached
  // on the teacher's device after the first visit.
  const { data: classes } = useQuery({
    queryKey: ['teacher', 'classes'],
    queryFn: () => simsService.getMyClasses(),
    staleTime: 5 * 60_000,
  });
  const cls = classes?.find((c) => c.id === classId);

  const { data: pupils, isLoading: pupilsLoading, error: pupilsError } = useQuery({
    queryKey: ['class', classId, 'pupils'],
    queryFn: () => simsService.getPupilsInClass(classId),
    enabled: !!classId,
    staleTime: 60_000,
  });

  if (pupilsLoading || !pupils) {
    return <LoadingState />;
  }

  if (pupilsError) {
    return (
      <Card className="border-red-400/30 bg-red-400/[0.04]">
        <div className="font-display text-display-3 text-red-400">Could not load pupils</div>
        <p className="mt-s-3 text-body text-ink-2">{pupilsError.message}</p>
        <div className="mt-s-5">
          <Link to="/app/teacher/attendance">
            <Button intent="ghost" size="md">← Back to classes</Button>
          </Link>
        </div>
      </Card>
    );
  }

  if (pupils.length === 0) {
    return (
      <Card>
        <div className="font-display text-display-3 text-ink-0">No pupils in this class.</div>
        <p className="mt-s-3 text-body text-ink-2">
          Add pupils to this class before taking attendance. Your school
          administrator can do this from the Enrolments page.
        </p>
        <div className="mt-s-5">
          <Link to="/app/teacher/attendance">
            <Button intent="ghost" size="md">← Back to classes</Button>
          </Link>
        </div>
      </Card>
    );
  }

  return <RegisterView classId={classId} cls={cls} pupils={pupils} onBack={() => navigate('/app/teacher/attendance')} />;
}

function RegisterView({ classId, cls, pupils, onBack }) {
  const {
    register, counts, setStatus, setNote, markAllPresent,
    save, saving, savedAt, error, today,
  } = useAttendance({ classId, pupils });

  const dateLabel = new Date(today).toLocaleDateString('en-NG', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <div className="max-w-[820px]">
      {/* Sticky summary header — counts always visible while scrolling.
          On the AppShell the header is at top-0, so this offsets to 64px. */}
      <div className="sticky top-[64px] z-30 -mx-s-6 lg:-mx-s-9 px-s-6 lg:px-s-9 py-s-4 bg-surface-1/95 backdrop-blur-md border-b border-line-1">
        <div className="flex items-center gap-s-4 mb-s-3">
          <button
            onClick={onBack}
            className="text-ink-3 hover:text-ink-1 text-[14px] flex items-center gap-s-2 transition-colors"
            aria-label="Back to classes"
          >
            ← <span className="hidden sm:inline">Classes</span>
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-[22px] leading-tight text-ink-0 truncate">
              {cls?.name ?? 'Register'}
            </h2>
            <div className="font-mono text-meta text-ink-3 truncate">{dateLabel}</div>
          </div>
        </div>

        <div className="flex items-center gap-s-3 flex-wrap">
          <Chip variant="green" dot>P · {counts.present}</Chip>
          <Chip variant="amber" dot>L · {counts.late}</Chip>
          <Chip variant="red" dot>A · {counts.absent}</Chip>
          <span className="font-mono text-meta text-ink-3">of {counts.total}</span>
          <button
            onClick={markAllPresent}
            className="ml-auto text-[12.5px] text-gold-200 hover:text-gold-50 underline-offset-4 hover:underline"
          >
            Reset all to present
          </button>
        </div>
      </div>

      {/* Pupil list */}
      <div className="bg-surface-2 border border-line-1 rounded-r-3 my-s-5 overflow-hidden">
        {pupils.map((pupil) => (
          <PupilRow
            key={pupil.id}
            pupil={pupil}
            entry={register[pupil.id] ?? { status: 'present', note: '', dirty: false }}
            onStatus={setStatus}
            onNote={setNote}
          />
        ))}
      </div>

      {/* Sticky save bar — always reachable without scrolling to bottom */}
      <div className="sticky bottom-0 -mx-s-6 lg:-mx-s-9 px-s-6 lg:px-s-9 py-s-4 bg-surface-1/95 backdrop-blur-md border-t border-line-1">
        <div className="flex items-center gap-s-4 flex-wrap">
          <Button
            intent="primary"
            size="lg"
            onClick={save}
            isLoading={saving}
            className="flex-1 sm:flex-initial justify-center min-w-[180px]"
          >
            Save register
          </Button>

          <div className="font-mono text-meta text-ink-3 flex-1 min-w-0 truncate">
            {error ? (
              <span className="text-red-400">{error}</span>
            ) : savedAt ? (
              <span className="text-green-400">Saved at {formatTime(savedAt)}</span>
            ) : counts.dirty > 0 ? (
              <>{counts.dirty} {counts.dirty === 1 ? 'change' : 'changes'} not saved</>
            ) : (
              'No changes yet'
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="max-w-[820px] animate-pulse">
      <div className="h-[80px] bg-surface-2 rounded-r-3 mb-s-5" />
      <div className="space-y-s-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-[56px] bg-surface-2 rounded-r-2" />
        ))}
      </div>
    </div>
  );
}

function formatTime(d) {
  return d.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
}
