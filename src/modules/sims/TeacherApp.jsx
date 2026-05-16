/**
 * src/modules/sims/TeacherApp.jsx
 *
 * /app/teacher/*
 *
 * The teacher's daily operational surface. Routes to:
 *
 *   /app/teacher              → Today view (class list + quick-mark)
 *   /app/teacher/attendance/:classId  → Full attendance register
 *   /app/teacher/gradebook            → Assessment list + score entry
 *   /app/teacher/gradebook/:classId   → Gradebook for a specific class
 *   /app/teacher/reports              → Report generation
 *   /app/teacher/schedule             → My classes + assignments
 *
 * DESIGN PRINCIPLE: 8AM FLOW
 * A teacher opens the app, marks attendance for their first class,
 * logs the lesson, and is done in under 2 minutes. Every screen is
 * optimised for that sequence.
 *
 * DATA STRATEGY
 * ─────────────
 * - Classes load once on app mount, cached for the session.
 * - Attendance state lives in useAttendance (offline-queue backed).
 * - Gradebook loads on demand per class — not preloaded.
 * - No N+1 queries: every list view uses one round-trip.
 */

import { useState, lazy, Suspense } from 'react';
import { Routes, Route, Link, useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { useAttendance, ATTENDANCE_STATUS } from '@/hooks/useAttendance';
import * as simsService from '@/services/simsService';
import * as gradebookService from '@/services/gradebookService';

const NAV = [
  { to: '/app/teacher',             label: 'Today',      end: true },
  { to: '/app/teacher/attendance',  label: 'Attendance' },
  { to: '/app/teacher/gradebook',   label: 'Gradebook'  },
  { to: '/app/teacher/reports',     label: 'Reports'    },
  { to: '/app/teacher/schedule',    label: 'Schedule'   },
];

export default function TeacherApp() {
  return (
    <Routes>
      <Route index                               element={<TodayView />} />
      <Route path="attendance"                   element={<AttendanceListView />} />
      <Route path="attendance/:classId"          element={<AttendanceRegisterView />} />
      <Route path="gradebook"                    element={<GradebookListView />} />
      <Route path="gradebook/:classId"           element={<GradebookClassView />} />
      <Route path="reports"                      element={<ReportsView />} />
      <Route path="schedule"                     element={<ScheduleView />} />
    </Routes>
  );
}

// ── Shared: my classes ────────────────────────────────────────────────────────

function useMyClasses() {
  return useQuery({
    queryKey: ['teacher', 'my-classes'],
    queryFn:  simsService.getMyClasses,
    staleTime: 10 * 60_000,
  });
}

// ── Today view ────────────────────────────────────────────────────────────────

function TodayView() {
  const { profile } = useAuth();
  const { data: classes, isLoading } = useMyClasses();
  const today = new Date().toISOString().slice(0, 10);
  const todayLabel = new Date().toLocaleDateString('en-NG', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  // Check which classes already have attendance for today
  const { data: markedToday } = useQuery({
    queryKey: ['teacher', 'attendance-marked-today', today],
    queryFn:  async () => {
      if (!classes?.length) return new Set();
      const ids = classes.map((c) => c.id);
      const { data } = await import('@/lib/supabase').then(({ supabase }) =>
        supabase
          .from('attendance')
          .select('class_id')
          .in('class_id', ids)
          .eq('date', today)
      );
      return new Set((data ?? []).map((r) => r.class_id));
    },
    enabled:  !!classes?.length,
    staleTime: 60_000,
  });

  return (
    <AppShell title="Today" navItems={NAV}>
      <div className="max-w-[820px]">
        <div className="mb-s-8">
          <div className="font-mono text-eyebrow uppercase text-gold-400">{todayLabel}</div>
          <h2 className="mt-s-3 font-display text-display-2 text-ink-0">
            Good morning{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}.
          </h2>
          <p className="mt-s-3 text-body text-ink-2 max-w-[56ch]">
            Mark attendance for each class. The whole register takes under 2 minutes.
          </p>
        </div>

        {isLoading && <ClassListSkeleton />}

        {!isLoading && (classes?.length ?? 0) === 0 && (
          <Card className="bg-surface-2 border-line-2">
            <p className="text-body text-ink-2">
              You have no classes assigned. Contact your head teacher or school admin.
            </p>
          </Card>
        )}

        {/* Class cards — one per assigned class */}
        <div className="space-y-s-4">
          {(classes ?? []).map((cls) => {
            const alreadyMarked = markedToday?.has(cls.id) ?? false;
            return (
              <Card key={cls.id} className="bg-surface-2 border-line-2 hover:border-gold-400/30 transition-colors">
                <div className="flex items-start justify-between gap-s-4">
                  <div>
                    <h3 className="font-display text-display-3 text-ink-0">{cls.name}</h3>
                    <div className="mt-s-1 font-mono text-meta text-ink-3">
                      {cls.level} · {cls.pupil_count ?? '?'} pupils
                    </div>
                  </div>
                  {alreadyMarked
                    ? <Chip variant="green" dot>Attendance done</Chip>
                    : <Chip variant="amber" dot>Not yet marked</Chip>
                  }
                </div>
                <div className="mt-s-5 flex gap-s-3">
                  <Link to={`/app/teacher/attendance/${cls.id}`}>
                    <Button intent={alreadyMarked ? 'ghost' : 'primary'} size="md">
                      {alreadyMarked ? 'Edit attendance' : 'Mark attendance →'}
                    </Button>
                  </Link>
                  <Link to={`/app/teacher/gradebook/${cls.id}`}>
                    <Button intent="ghost" size="md">Gradebook</Button>
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}

// ── Attendance list ───────────────────────────────────────────────────────────

function AttendanceListView() {
  const { data: classes, isLoading } = useMyClasses();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <AppShell title="Attendance" navItems={NAV}>
      <div className="max-w-[720px]">
        <div className="mb-s-7">
          <div className="font-mono text-eyebrow uppercase text-gold-400">Attendance</div>
          <h2 className="mt-s-3 font-display text-display-2 text-ink-0">Select a class.</h2>
        </div>
        {isLoading && <ClassListSkeleton />}
        <div className="space-y-s-3">
          {(classes ?? []).map((cls) => (
            <Link key={cls.id} to={`/app/teacher/attendance/${cls.id}`}>
              <Card className="bg-surface-2 border-line-2 hover:border-gold-400/40 transition-colors flex items-center justify-between">
                <div>
                  <div className="font-display text-[17px] text-ink-0">{cls.name}</div>
                  <div className="font-mono text-meta text-ink-3">{cls.level} · {cls.pupil_count ?? '?'} pupils</div>
                </div>
                <span className="text-gold-400">→</span>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

// ── Attendance register ───────────────────────────────────────────────────────

function AttendanceRegisterView() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);

  const { data: pupils, isLoading: pupilsLoading } = useQuery({
    queryKey: ['teacher', 'pupils', classId],
    queryFn:  () => simsService.getPupilsInClass(classId),
    enabled:  !!classId,
    staleTime: 10 * 60_000,
  });

  const {
    register, counts, setStatus, setNote,
    markAllPresent, save, saving, savedAt, error, isReady, today: regDate,
  } = useAttendance({ classId, pupils: pupils ?? [], date: today });

  const { data: cls } = useQuery({
    queryKey: ['teacher', 'class', classId],
    queryFn:  () => import('@/lib/supabase').then(({ supabase }) =>
      supabase.from('classes').select('name, level').eq('id', classId).single().then((r) => r.data)
    ),
    enabled:  !!classId,
    staleTime: 30 * 60_000,
  });

  if (pupilsLoading || !isReady) {
    return (
      <AppShell title="Attendance" navItems={NAV}>
        <div className="space-y-s-3 max-w-[620px]">
          {[1,2,3,4,5].map((i) => <div key={i} className="h-14 bg-surface-2 rounded-r-2 animate-pulse" />)}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Attendance" navItems={NAV}>
      <div className="max-w-[620px]">
        {/* Header */}
        <div className="mb-s-6">
          <button className="font-mono text-meta text-ink-3 hover:text-ink-1 mb-s-3" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <div className="font-mono text-eyebrow uppercase text-gold-400">{regDate}</div>
          <h2 className="mt-s-2 font-display text-display-2 text-ink-0">{cls?.name ?? 'Class'}</h2>

          {/* Summary band */}
          <div className="mt-s-4 flex gap-s-5 flex-wrap">
            <StatPill label="Present" value={counts.present} color="text-green-400" />
            <StatPill label="Absent"  value={counts.absent}  color="text-red-400"   />
            <StatPill label="Late"    value={counts.late}    color="text-amber-400" />
            <StatPill label="Total"   value={counts.total}   color="text-ink-1"     />
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-s-3 mb-s-5">
          <Button intent="ghost" size="sm" onClick={markAllPresent}>Mark all present</Button>
          {savedAt && (
            <span className="font-mono text-meta text-green-400">
              Saved {savedAt.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        {/* Register */}
        <div className="bg-surface-2 border border-line-2 rounded-r-3 overflow-hidden">
          {(pupils ?? []).map((pupil, i) => {
            const entry = register[pupil.id] ?? { status: ATTENDANCE_STATUS.PRESENT, note: '' };
            return (
              <PupilAttendanceRow
                key={pupil.id}
                pupil={pupil}
                entry={entry}
                onStatus={(s) => setStatus(pupil.id, s)}
                onNote={(n) => setNote(pupil.id, n)}
                isLast={i === (pupils?.length ?? 0) - 1}
              />
            );
          })}
        </div>

        {error && (
          <div className="mt-s-4 p-s-3 bg-red-500/10 border border-red-500/30 rounded-r-1">
            <p className="text-body text-red-400">{error}</p>
          </div>
        )}

        {/* Save button */}
        <div className="mt-s-6 flex items-center gap-s-4">
          <Button intent="primary" size="lg" onClick={save} disabled={saving} className="flex-1 justify-center">
            {saving ? 'Saving…' : `Save register${counts.dirty > 0 ? ` · ${counts.dirty} change${counts.dirty !== 1 ? 's' : ''}` : ''}`}
          </Button>
        </div>

        <p className="mt-s-4 font-mono text-meta text-ink-3">
          Saved locally first. Syncs automatically when online.
        </p>
      </div>
    </AppShell>
  );
}

function PupilAttendanceRow({ pupil, entry, onStatus, onNote, isLast }) {
  const [showNote, setShowNote] = useState(!!entry.note);

  const STATUS_BTNS = [
    { key: ATTENDANCE_STATUS.PRESENT, label: 'P', color: 'bg-green-400/20 border-green-400/60 text-green-400' },
    { key: ATTENDANCE_STATUS.LATE,    label: 'L', color: 'bg-amber-400/20 border-amber-400/60 text-amber-400' },
    { key: ATTENDANCE_STATUS.ABSENT,  label: 'A', color: 'bg-red-400/20   border-red-400/60   text-red-400'   },
  ];

  return (
    <div className={`px-s-4 py-s-3 ${isLast ? '' : 'border-b border-line-2'} ${entry.dirty ? 'bg-gold-400/[0.03]' : ''}`}>
      <div className="flex items-center gap-s-4">
        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-surface-3 border border-line-2 grid place-items-center font-mono text-[11px] text-ink-3 flex-shrink-0">
          {(pupil.full_name ?? '?').charAt(0).toUpperCase()}
        </div>

        {/* Name */}
        <div className="flex-1 min-w-0">
          <div className="text-[14px] text-ink-1 truncate">{pupil.full_name}</div>
          {pupil.pupil_code && (
            <div className="font-mono text-[11px] text-ink-3">{pupil.pupil_code}</div>
          )}
        </div>

        {/* Status buttons */}
        <div className="flex gap-s-2">
          {STATUS_BTNS.map((btn) => (
            <button
              key={btn.key}
              onClick={() => onStatus(btn.key)}
              className={`w-9 h-9 rounded-r-1 border font-mono text-[13px] font-semibold transition-colors ${
                entry.status === btn.key
                  ? btn.color
                  : 'bg-surface-3 border-line-2 text-ink-3 hover:border-line-3'
              }`}
              aria-label={btn.key}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* Note toggle */}
        <button
          className="font-mono text-[11px] text-ink-3 hover:text-gold-400 transition-colors"
          onClick={() => setShowNote((v) => !v)}
          aria-label="Add note"
        >
          {showNote ? '×' : '+ note'}
        </button>
      </div>

      {showNote && (
        <div className="mt-s-2 pl-[48px]">
          <input
            className="w-full bg-surface-3 border border-line-2 rounded-r-1 px-s-3 py-s-2 text-[13px] text-ink-0 placeholder-ink-3 focus:border-gold-400 outline-none"
            placeholder="Note (optional)"
            value={entry.note ?? ''}
            onChange={(e) => onNote(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}

// ── Gradebook list ────────────────────────────────────────────────────────────

function GradebookListView() {
  const { data: classes, isLoading } = useMyClasses();

  return (
    <AppShell title="Gradebook" navItems={NAV}>
      <div className="max-w-[720px]">
        <div className="mb-s-7">
          <div className="font-mono text-eyebrow uppercase text-gold-400">Gradebook</div>
          <h2 className="mt-s-3 font-display text-display-2 text-ink-0">Select a class.</h2>
        </div>
        {isLoading && <ClassListSkeleton />}
        <div className="space-y-s-3">
          {(classes ?? []).map((cls) => (
            <Link key={cls.id} to={`/app/teacher/gradebook/${cls.id}`}>
              <Card className="bg-surface-2 border-line-2 hover:border-gold-400/40 transition-colors flex items-center justify-between">
                <div>
                  <div className="font-display text-[17px] text-ink-0">{cls.name}</div>
                  <div className="font-mono text-meta text-ink-3">{cls.level} · {cls.pupil_count ?? '?'} pupils</div>
                </div>
                <span className="text-gold-400">→</span>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

// ── Gradebook class view ──────────────────────────────────────────────────────

function GradebookClassView() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const currentTerm = getCurrentTerm();

  const [subject, setSubject] = useState('');
  const [selectedColumn, setSelectedColumn] = useState(null);

  const { data: cls } = useQuery({
    queryKey: ['teacher', 'class', classId],
    queryFn:  () => import('@/lib/supabase').then(({ supabase }) =>
      supabase.from('classes').select('name, level, school_id').eq('id', classId).single().then((r) => r.data)
    ),
    enabled: !!classId,
    staleTime: 30 * 60_000,
  });

  const { data: pupils } = useQuery({
    queryKey: ['teacher', 'pupils', classId],
    queryFn:  () => simsService.getPupilsInClass(classId),
    enabled:  !!classId,
    staleTime: 10 * 60_000,
  });

  const { data: gradebook, isLoading: gbLoading } = useQuery({
    queryKey: ['teacher', 'gradebook', classId, subject, currentTerm, currentYear],
    queryFn:  () => gradebookService.getGradebook({
      classId, subject, term: currentTerm, year: currentYear,
    }),
    enabled:  !!classId && !!subject,
    staleTime: 60_000,
  });

  // Derive subject list from the class level (NERDC standard subjects)
  const SUBJECTS_BY_LEVEL = {
    primary: ['Mathematics', 'English Language', 'Basic Science', 'Social Studies', 'Yoruba'],
    jss:     ['Mathematics', 'English Language', 'Basic Science', 'Social Studies', 'French', 'CRS/IRS'],
    sss:     ['Mathematics', 'English Language', 'Physics', 'Chemistry', 'Biology', 'Economics', 'Government'],
  };
  const levelKey = (cls?.level ?? '').toLowerCase().includes('primary') ? 'primary'
    : (cls?.level ?? '').toLowerCase().includes('jss') ? 'jss' : 'sss';
  const subjects = SUBJECTS_BY_LEVEL[levelKey] ?? [];

  return (
    <AppShell title="Gradebook" navItems={NAV}>
      <div className="max-w-[900px]">
        <button className="font-mono text-meta text-ink-3 hover:text-ink-1 mb-s-5" onClick={() => navigate(-1)}>
          ← Back
        </button>

        <div className="mb-s-6">
          <div className="font-mono text-eyebrow uppercase text-gold-400">Gradebook</div>
          <h2 className="mt-s-2 font-display text-display-2 text-ink-0">{cls?.name ?? 'Class'}</h2>
          <p className="mt-s-2 font-mono text-meta text-ink-3">
            Term {currentTerm} · {currentYear}
            {gradebook?.locked && (
              <span className="ml-s-3 text-amber-400">🔒 Term locked — scores are read-only</span>
            )}
          </p>
        </div>

        {/* Subject selector */}
        <div className="mb-s-6">
          <div className="font-mono text-eyebrow uppercase text-ink-3 mb-s-2">Subject</div>
          <div className="flex flex-wrap gap-s-2">
            {subjects.map((s) => (
              <button key={s}
                className={`px-s-4 py-s-2 rounded-full border font-mono text-meta transition-colors ${
                  subject === s
                    ? 'bg-gold-400 border-gold-400 text-ink-0'
                    : 'bg-surface-2 border-line-2 text-ink-2 hover:border-line-3'
                }`}
                onClick={() => { setSubject(s); setSelectedColumn(null); }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {!subject && (
          <Card className="bg-surface-2 border-line-2">
            <p className="text-body text-ink-2">Select a subject above to view the gradebook.</p>
          </Card>
        )}

        {subject && gbLoading && (
          <div className="space-y-s-2">
            {[1,2,3].map((i) => <div key={i} className="h-12 bg-surface-2 rounded-r-1 animate-pulse" />)}
          </div>
        )}

        {subject && gradebook && !gbLoading && (
          <GradebookGrid
            gradebook={gradebook}
            pupils={pupils ?? []}
            classId={classId}
            subject={subject}
            term={currentTerm}
            year={currentYear}
            locked={gradebook.locked}
          />
        )}
      </div>
    </AppShell>
  );
}

function GradebookGrid({ gradebook, pupils, classId, subject, term, year, locked }) {
  const qc = useQueryClient?.() ?? { invalidateQueries: () => {} };
  const [saving, setSaving] = useState(false);
  const [localScores, setLocalScores] = useState({});
  const [savedAt, setSavedAt] = useState(null);
  const [error, setError] = useState(null);

  // Build initial local scores from the gradebook data
  const scoreMap = {};
  for (const score of (gradebook.scores ?? [])) {
    if (!scoreMap[score.pupil_id]) scoreMap[score.pupil_id] = {};
    scoreMap[score.pupil_id][score.column_id] = score.score;
  }

  function setScore(pupilId, columnId, value) {
    setLocalScores((prev) => ({
      ...prev,
      [`${pupilId}:${columnId}`]: value,
    }));
  }

  function getScore(pupilId, columnId) {
    const local = localScores[`${pupilId}:${columnId}`];
    if (local !== undefined) return local;
    return scoreMap[pupilId]?.[columnId] ?? '';
  }

  async function handleSave(columnId) {
    if (locked) return;
    setSaving(true);
    setError(null);
    try {
      const column = gradebook.columns.find((c) => c.id === columnId);
      const scores = pupils.map((p) => ({
        pupilId:  p.id,
        score:    parseInt(getScore(p.id, columnId), 10) || 0,
        maxScore: column?.max_score ?? 100,
      }));
      await gradebookService.saveColumnScores({
        columnId,
        classId,
        scores,
        idempotencyKey: crypto.randomUUID(),
      });
      setSavedAt(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if ((gradebook.columns ?? []).length === 0) {
    return (
      <Card className="bg-surface-2 border-line-2">
        <p className="text-body text-ink-2">
          No gradebook columns set up for {subject} in Term {term}. Contact your head teacher to set up columns.
        </p>
      </Card>
    );
  }

  return (
    <div>
      {error && (
        <div className="mb-s-4 p-s-3 bg-red-500/10 border border-red-500/30 rounded-r-1">
          <p className="text-body text-red-400">{error}</p>
        </div>
      )}
      {savedAt && (
        <p className="mb-s-3 font-mono text-meta text-green-400">
          Saved {savedAt.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left min-w-[600px]">
          <thead>
            <tr className="border-b border-line-2">
              <th className="font-mono text-eyebrow uppercase text-ink-3 pb-s-3 pr-s-5 text-xs w-[180px]">
                Pupil
              </th>
              {gradebook.columns.map((col) => (
                <th key={col.id} className="font-mono text-eyebrow uppercase text-ink-3 pb-s-3 pr-s-4 text-xs text-right">
                  <div>{col.name}</div>
                  <div className="font-normal normal-case text-[10px] text-ink-3">/{col.max_score}</div>
                </th>
              ))}
              <th className="font-mono text-eyebrow uppercase text-ink-3 pb-s-3 text-xs text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {pupils.map((pupil) => {
              const total = gradebook.columns.reduce((sum, col) => {
                const s = parseInt(getScore(pupil.id, col.id), 10);
                return sum + (isNaN(s) ? 0 : s);
              }, 0);
              const maxTotal = gradebook.columns.reduce((s, c) => s + c.max_score, 0);

              return (
                <tr key={pupil.id} className="border-b border-line-2 last:border-0 hover:bg-surface-3 transition-colors">
                  <td className="py-s-3 pr-s-5">
                    <div className="text-body text-ink-1 truncate max-w-[160px]">{pupil.full_name}</div>
                  </td>
                  {gradebook.columns.map((col) => (
                    <td key={col.id} className="py-s-3 pr-s-4 text-right">
                      <input
                        type="number"
                        min={0}
                        max={col.max_score}
                        disabled={locked}
                        className={`w-14 text-right bg-surface-3 border border-line-2 rounded px-s-2 py-s-1 font-mono text-meta text-ink-0 focus:border-gold-400 outline-none tabular-nums ${
                          locked ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                        value={getScore(pupil.id, col.id)}
                        onChange={(e) => setScore(pupil.id, col.id, e.target.value)}
                      />
                    </td>
                  ))}
                  <td className="py-s-3 text-right">
                    <span className="font-mono text-meta text-ink-0 tabular-nums">
                      {total}/{maxTotal}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!locked && (
        <div className="mt-s-5 flex flex-wrap gap-s-3">
          {gradebook.columns.map((col) => (
            <Button
              key={col.id}
              intent="primary"
              size="sm"
              disabled={saving}
              onClick={() => handleSave(col.id)}
            >
              {saving ? 'Saving…' : `Save ${col.name}`}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Reports view ──────────────────────────────────────────────────────────────

function ReportsView() {
  const { data: classes } = useMyClasses();
  const [selectedClass, setSelectedClass] = useState(null);
  const [generating, setGenerating] = useState({});

  const { data: pupils } = useQuery({
    queryKey: ['teacher', 'pupils', selectedClass],
    queryFn:  () => simsService.getPupilsInClass(selectedClass),
    enabled:  !!selectedClass,
    staleTime: 10 * 60_000,
  });

  const currentYear = new Date().getFullYear();
  const currentTerm = getCurrentTerm();

  async function handleGenerateReport(pupilId, pupilName) {
    setGenerating((prev) => ({ ...prev, [pupilId]: true }));
    try {
      const result = await simsService.generateTermReport({
        pupilId,
        termId: null, // uses current term server-side
      });
      if (result?.url) window.open(result.url, '_blank');
    } catch (e) {
      alert(`Could not generate report for ${pupilName}: ${e.message}`);
    } finally {
      setGenerating((prev) => ({ ...prev, [pupilId]: false }));
    }
  }

  return (
    <AppShell title="Reports" navItems={NAV}>
      <div className="max-w-[820px]">
        <div className="mb-s-7">
          <div className="font-mono text-eyebrow uppercase text-gold-400">Reports</div>
          <h2 className="mt-s-3 font-display text-display-2 text-ink-0">Generate term reports.</h2>
          <p className="mt-s-3 text-body text-ink-2 max-w-[56ch]">
            Term {currentTerm} · {currentYear}. Select a class, then generate individual or bulk reports.
          </p>
        </div>

        {/* Class selector */}
        <div className="mb-s-5">
          <div className="font-mono text-eyebrow uppercase text-ink-3 mb-s-2">Class</div>
          <select
            className="bg-surface-2 border border-line-2 rounded-r-1 px-s-4 py-s-3 text-body text-ink-0 focus:border-gold-400 outline-none"
            value={selectedClass ?? ''}
            onChange={(e) => setSelectedClass(e.target.value || null)}
          >
            <option value="">Select a class…</option>
            {(classes ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {selectedClass && pupils && (
          <Card className="bg-surface-2 border-line-2 overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line-2">
                  <th className="font-mono text-eyebrow uppercase text-ink-3 pb-s-3 pr-s-5 text-xs">Pupil</th>
                  <th className="font-mono text-eyebrow uppercase text-ink-3 pb-s-3 text-xs text-right">Report</th>
                </tr>
              </thead>
              <tbody>
                {pupils.map((p) => (
                  <tr key={p.id} className="border-b border-line-2 last:border-0 hover:bg-surface-3 transition-colors">
                    <td className="py-s-3 pr-s-5">
                      <div className="text-body text-ink-1">{p.full_name}</div>
                    </td>
                    <td className="py-s-3 text-right">
                      <Button
                        intent="ghost"
                        size="sm"
                        disabled={generating[p.id]}
                        onClick={() => handleGenerateReport(p.id, p.full_name)}
                      >
                        {generating[p.id] ? 'Generating…' : 'Generate PDF'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

// ── Schedule view ─────────────────────────────────────────────────────────────

function ScheduleView() {
  const { profile } = useAuth();
  const { data: classes, isLoading } = useMyClasses();

  return (
    <AppShell title="Schedule" navItems={NAV}>
      <div className="max-w-[720px]">
        <div className="mb-s-7">
          <div className="font-mono text-eyebrow uppercase text-gold-400">My schedule</div>
          <h2 className="mt-s-3 font-display text-display-2 text-ink-0">
            {profile?.full_name ?? 'Teacher'}'s classes.
          </h2>
        </div>
        {isLoading && <ClassListSkeleton />}
        {(classes?.length ?? 0) === 0 && !isLoading && (
          <Card className="bg-surface-2 border-line-2">
            <p className="text-body text-ink-2">No classes assigned. Contact your head teacher.</p>
          </Card>
        )}
        <div className="space-y-s-4">
          {(classes ?? []).map((cls) => (
            <Card key={cls.id} className="bg-surface-2 border-line-2">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-display text-display-3 text-ink-0">{cls.name}</h3>
                  <div className="mt-s-1 font-mono text-meta text-ink-3">
                    {cls.level} · {cls.pupil_count ?? '?'} pupils
                  </div>
                </div>
              </div>
              <div className="mt-s-4 flex gap-s-3">
                <Link to={`/app/teacher/attendance/${cls.id}`}>
                  <Button intent="ghost" size="sm">Attendance</Button>
                </Link>
                <Link to={`/app/teacher/gradebook/${cls.id}`}>
                  <Button intent="ghost" size="sm">Gradebook</Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getCurrentTerm() {
  const month = new Date().getMonth() + 1;
  if (month >= 9 || month <= 12) return 1;
  if (month >= 1 && month <= 3)  return 2;
  return 3;
}

function StatPill({ label, value, color }) {
  return (
    <div className="text-center">
      <div className={`font-display text-display-2 ${color} tabular-nums`}>{value}</div>
      <div className="font-mono text-meta text-ink-3">{label}</div>
    </div>
  );
}

function ClassListSkeleton() {
  return (
    <div className="space-y-s-3">
      {[1,2,3].map((i) => <div key={i} className="h-16 bg-surface-2 rounded-r-2 animate-pulse border border-line-2" />)}
    </div>
  );
}

// Import useQueryClient lazily to avoid issues if it's not provided
function useQueryClient() {
  try {
    return require('@tanstack/react-query').useQueryClient();
  } catch { return { invalidateQueries: () => {} }; }
}
