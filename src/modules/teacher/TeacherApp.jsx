/**
 * src/modules/teacher/TeacherApp.jsx
 *
 * /app/teacher — teacher and head_teacher roles.
 *
 * SECTIONS
 * ────────
 * Dashboard   → today's classes, attendance status, pending tasks
 * Attendance  → pick a class → mark present/absent/late
 * Gradebook   → list assessments, enter scores
 * Reports     → view class report list, enter comments, submit for approval
 *
 * DATA APPROACH
 * ─────────────
 * The dashboard calls get_teacher_daily_summary RPC (migration 0009) which
 * returns all classes + today's attendance status + pending score count in
 * one call. No N+1 round trips.
 *
 * Attendance and score entry reuse the existing hooks (useAttendance,
 * gradebookService) — the teacher module is a new UI shell over proven logic.
 */

import { useState, useRef, useCallback, Suspense, lazy } from 'react';
import { Routes, Route, Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { Card, KpiCard } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { QuickActionCard, QuickActionGrid } from '@/components/ui/QuickActionCard';
import { useAuth } from '@/hooks/useAuth';
import { useAttendance } from '@/hooks/useAttendance';
import * as simsService from '@/services/simsService';
import * as reportsService from '@/services/reportsService';
import { supabase } from '@/lib/supabase';
import { CommsView } from '@/modules/sims/CommsView';

const NAV = [
  { to: '/app/teacher',             label: 'Dashboard',  end: true },
  { to: '/app/teacher/attendance',  label: 'Attendance'  },
  { to: '/app/teacher/gradebook',   label: 'Gradebook'   },
  { to: '/app/teacher/reports',     label: 'Reports'     },
  { to: '/app/teacher/comms',       label: 'Comms'       },
];

// ── Router ────────────────────────────────────────────────────────────────────

export default function TeacherApp() {
  return (
    <Routes>
      <Route index                   element={<TeacherDashboard />} />
      <Route path="attendance"       element={<AttendanceHub />} />
      <Route path="attendance/:cid"  element={<AttendanceRegister />} />
      <Route path="gradebook"        element={<GradebookHub />} />
      <Route path="reports"          element={<ReportsHub />} />
      <Route path="comms"            element={<CommsView />} />
    </Routes>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

function TeacherDashboard() {
  const { profile } = useAuth();
  const navigate    = useNavigate();

  const { data: summary, isLoading } = useQuery({
    queryKey:  ['teacher', 'daily', profile?.user_id],
    queryFn:   () => fetchDailySummary(profile.user_id),
    enabled:   !!profile?.user_id,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const classes = summary?.classes ?? [];
  const doneCount = classes.filter((c) => c.attendance_done).length;
  const pendingScores = classes.reduce((a, c) => a + Number(c.pending_scores ?? 0), 0);
  const pendingReports = summary?.pending_report_count ?? 0;
  const dayName = (summary?.day_name ?? '').trim();
  const greeting = `Good ${hour() < 12 ? 'morning' : hour() < 17 ? 'afternoon' : 'evening'}`;

  return (
    <AppShell title="Dashboard" navItems={NAV}>
      <div className="max-w-[820px]">
        {/* Greeting */}
        <div className="mb-s-7">
          <div className="font-mono text-eyebrow uppercase text-gold-400">
            {dayName} · Teacher dashboard
          </div>
          <h2 className="mt-s-3 font-display text-display-2 text-ink-0">
            {greeting}, {profile?.full_name?.split(' ')[0] ?? 'Teacher'}.
          </h2>
        </div>

        {/* Quick KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-s-4 mb-s-8">
          <KpiCard
            label="Classes today"
            value={classes.length.toString()}
            trend={`${doneCount} of ${classes.length} attendance done`}
            trendIntent={doneCount === classes.length ? 'green' : 'amber'}
          />
          <KpiCard
            label="Pending scores"
            value={pendingScores.toString()}
            trend={pendingScores > 0 ? 'assessments without scores' : 'all scored'}
            trendIntent={pendingScores > 0 ? 'amber' : 'green'}
          />
          <KpiCard
            label="Reports queue"
            value={pendingReports.toString()}
            trend={pendingReports > 0 ? 'drafts or awaiting approval' : 'all clear'}
            trendIntent={pendingReports > 0 ? 'amber' : 'green'}
          />
        </div>

        {/* Classes with attendance status */}
        {isLoading
          ? <Skeleton rows={3} />
          : <div className="space-y-s-4 mb-s-8">
              <div className="font-mono text-eyebrow uppercase text-gold-400">Your classes</div>
              {classes.length === 0 && (
                <Card className="bg-surface-2 border-line-2">
                  <p className="text-body text-ink-2">
                    No classes assigned. Ask your school admin to assign you to a class.
                  </p>
                </Card>
              )}
              {classes.map((cls) => (
                <ClassCard
                  key={cls.class_id}
                  cls={cls}
                  onAttendance={() => navigate(`/app/teacher/attendance/${cls.class_id}`)}
                  onGradebook={() => navigate('/app/teacher/gradebook')}
                />
              ))}
            </div>
        }

        {/* Quick-action grid — design system §09 · SIMS surface */}
        <QuickActionGrid className="mb-s-4">
          <QuickActionCard
            variant={doneCount < classes.length ? 'primary' : 'default'}
            urgent={doneCount < classes.length}
            label="Mark attendance"
            meta={doneCount < classes.length
              ? `${classes.length - doneCount} class${classes.length - doneCount !== 1 ? 'es' : ''} · not started`
              : `${doneCount} of ${classes.length} done`
            }
            icon={<CheckSvg />}
            to="/app/teacher/attendance"
          />
          <QuickActionCard
            urgent={pendingScores > 0}
            label="Enter scores"
            meta={pendingScores > 0
              ? `${pendingScores} assessment${pendingScores !== 1 ? 's' : ''} waiting`
              : 'All scored'
            }
            icon={<BarSvg />}
            to="/app/teacher/gradebook"
          />
          <QuickActionCard
            urgent={pendingReports > 0}
            label="Review reports"
            meta={pendingReports > 0 ? `${pendingReports} awaiting approval` : 'All clear'}
            icon={<ClipSvg />}
            to="/app/teacher/reports"
          />
          <QuickActionCard
            label="Message parents"
            meta="notes or WhatsApp"
            icon={<MsgSvg />}
            to="/app/teacher/comms"
          />
        </QuickActionGrid>
      </div>
    </AppShell>
  );
}

// ── Attendance hub — pick a class ─────────────────────────────────────────────

function AttendanceHub() {
  const { profile } = useAuth();
  const navigate    = useNavigate();
  const today       = new Date().toISOString().slice(0, 10);

  const { data: classes, isLoading } = useQuery({
    queryKey: ['teacher', 'classes', profile?.user_id],
    queryFn:  simsService.getMyClasses,
    staleTime: 5 * 60_000,
  });

  return (
    <AppShell title="Attendance" navItems={NAV}>
      <div className="max-w-[680px]">
        <div className="mb-s-7">
          <div className="font-mono text-eyebrow uppercase text-gold-400">
            Attendance · {formatDate(today)}
          </div>
          <h2 className="mt-s-3 font-display text-display-2 text-ink-0">
            Pick a class to mark.
          </h2>
        </div>

        {isLoading && <Skeleton rows={3} />}

        <div className="space-y-s-3">
          {(classes ?? []).map((cls) => (
            <button
              key={cls.id}
              onClick={() => navigate(`/app/teacher/attendance/${cls.id}`)}
              className="w-full text-left bg-surface-2 border border-line-2 rounded-r-3 p-s-5 hover:border-gold-400/40 transition-colors group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-display text-[18px] text-ink-0 group-hover:text-gold-400 transition-colors">
                    {cls.name}
                  </div>
                  <div className="font-mono text-meta text-ink-3 mt-s-1">
                    {cls.level} · {cls.pupil_count} pupils
                  </div>
                </div>
                <div className="text-gold-400">Mark →</div>
              </div>
            </button>
          ))}
          {!isLoading && (classes ?? []).length === 0 && (
            <Card className="bg-surface-2 border-line-2">
              <p className="text-body text-ink-2">No classes assigned. Contact your school admin.</p>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}

// ── Attendance register — mark one class ──────────────────────────────────────

function AttendanceRegister() {
  const { cid }  = useParams();
  const navigate = useNavigate();
  const today    = new Date().toISOString().slice(0, 10);
  const [showExport, setShowExport] = useState(false);

  const { data: pupils, isLoading } = useQuery({
    queryKey: ['pupils', cid],
    queryFn:  () => simsService.getPupilsInClass(cid),
    staleTime: 10 * 60_000,
  });

  const { register, markStatus, save, saving, savedAt, dirtyCount, error } =
    useAttendance({ classId: cid, pupils: pupils ?? [], date: today });

  const STATUS_CYCLE = ['present', 'absent', 'late'];
  const STATUS_COLOR = {
    present: 'bg-green-400/15 border-green-400/40 text-green-400',
    absent:  'bg-red-400/15   border-red-400/40   text-red-400',
    late:    'bg-amber-400/15 border-amber-400/40 text-amber-400',
  };

  if (isLoading) return (
    <AppShell title="Attendance" navItems={NAV}><Skeleton rows={6} /></AppShell>
  );

  return (
    <AppShell title="Attendance" navItems={NAV}>
      <div className="max-w-[600px]">
        {/* Header */}
        <div className="mb-s-6 flex items-start justify-between gap-s-4">
          <div>
            <button onClick={() => navigate('/app/teacher/attendance')}
              className="font-mono text-meta text-ink-3 hover:text-ink-1 mb-s-2">
              ← Classes
            </button>
            <div className="font-mono text-eyebrow uppercase text-gold-400">
              {formatDate(today)}
            </div>
            <h2 className="mt-s-1 font-display text-display-2 text-ink-0">
              {(pupils ?? []).length} pupils
            </h2>
          </div>
          <div className="text-right shrink-0 flex flex-col items-end gap-s-2">
            <div className="flex gap-s-2">
              <Button
                intent="ghost"
                size="sm"
                onClick={() => setShowExport(true)}
                title="Export attendance as CSV"
              >
                ↓ Export
              </Button>
              <Button
                intent="primary"
                size="lg"
                onClick={save}
                disabled={saving}
              >
                {saving ? 'Saving…' : `Save${dirtyCount > 0 ? ` (${dirtyCount})` : ''}`}
              </Button>
            </div>
            {savedAt && (
              <div className="font-mono text-meta text-green-400">
                ✓ Saved {new Date(savedAt).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
          </div>
        </div>

        {/* Export modal */}
        {showExport && (
          <AttendanceExportModal
            classId={cid}
            className={(pupils ?? []).length > 0 ? `class-${cid.slice(0, 8)}` : 'class'}
            onClose={() => setShowExport(false)}
          />
        )}

        {error && (
          <div className="mb-s-4 p-s-3 bg-red-400/10 border border-red-400/30 rounded-r-1">
            <p className="text-body text-red-400">{error}</p>
          </div>
        )}

        {/* Legend */}
        <div className="flex gap-s-3 mb-s-5">
          <span className="font-mono text-meta text-ink-3">Tap to cycle:</span>
          {STATUS_CYCLE.map((s) => (
            <span key={s} className={`font-mono text-meta px-s-2 py-[2px] rounded border ${STATUS_COLOR[s]} capitalize`}>{s}</span>
          ))}
        </div>

        {/* Pupil rows */}
        <div className="space-y-s-2">
          {(pupils ?? []).map((pupil) => {
            const entry  = register[pupil.id] ?? { status: 'present' };
            const status = entry.status;
            const nextStatus = STATUS_CYCLE[(STATUS_CYCLE.indexOf(status) + 1) % STATUS_CYCLE.length];

            return (
              <div key={pupil.id}
                className="flex items-center gap-s-4 bg-surface-2 border border-line-2 rounded-r-2 px-s-4 py-s-3">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-surface-3 border border-line-2 flex-shrink-0 grid place-items-center font-mono text-[12px] text-ink-3">
                  {pupil.full_name?.charAt(0) ?? '?'}
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <div className="text-body text-ink-0 truncate">{pupil.full_name}</div>
                  {pupil.pupil_code && (
                    <div className="font-mono text-meta text-ink-3">{pupil.pupil_code}</div>
                  )}
                </div>

                {/* Status toggle */}
                <button
                  onClick={() => markStatus(pupil.id, nextStatus)}
                  className={`px-s-4 py-s-2 rounded-r-1 border font-mono text-meta capitalize transition-all ${STATUS_COLOR[status]}`}
                  title={`Tap to mark ${nextStatus}`}
                >
                  {status}
                </button>
              </div>
            );
          })}
        </div>

        {/* Floating save */}
        <div className="mt-s-7 flex justify-end">
          <Button intent="primary" size="lg" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : `Save attendance${dirtyCount > 0 ? ` · ${dirtyCount} change${dirtyCount !== 1 ? 's' : ''}` : ''}`}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

// ── Attendance export modal ────────────────────────────────────────────────────
//
// Triggered by the "↓ Export" button in AttendanceRegister.
// Lets the teacher pick a date range (defaults to last 2 weeks),
// fetches the records, builds a CSV in-browser, and triggers download.
// No server-side work needed — the browser handles it all.

function buildAttendanceCsv(rows, pupils) {
  // Build a pivot: one row per pupil, one column per date
  const dates    = [...new Set(rows.map((r) => r.date))].sort();
  const byPupil  = {};

  for (const row of rows) {
    const name = row.pupils?.full_name ?? row.pupil_id;
    const code = row.pupils?.pupil_code ?? '';
    if (!byPupil[row.pupil_id]) {
      byPupil[row.pupil_id] = { name, code, dates: {} };
    }
    byPupil[row.pupil_id].dates[row.date] = row.status;
  }

  // Ensure every pupil appears even if they have no records for some dates
  for (const p of (pupils ?? [])) {
    if (!byPupil[p.id]) {
      byPupil[p.id] = { name: p.full_name, code: p.pupil_code ?? '', dates: {} };
    }
  }

  const header = ['Pupil Name', 'Pupil Code', ...dates].join(',');
  const body   = Object.values(byPupil)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((p) => {
      const cells = dates.map((d) => p.dates[d] ?? '—');
      return [`"${p.name}"`, p.code, ...cells].join(',');
    });

  const summary = [
    '',
    `"Total days: ${dates.length}"`,
    `"Export date: ${new Date().toLocaleDateString('en-NG')}"`,
  ];

  return [header, ...body, ...summary].join('\n');
}

function AttendanceExportModal({ classId, className, onClose }) {
  const today      = new Date().toISOString().slice(0, 10);
  const twoWeeksAgo = new Date(Date.now() - 14 * 86400_000).toISOString().slice(0, 10);

  const [fromDate, setFromDate] = useState(twoWeeksAgo);
  const [toDate,   setToDate]   = useState(today);
  const [dateError, setDateError] = useState('');

  const { data: pupils } = useQuery({
    queryKey: ['pupils', classId],
    queryFn:  () => simsService.getPupilsInClass(classId),
    staleTime: 10 * 60_000,
  });

  const exportMutation = useMutation({
    mutationFn: () => simsService.getAttendanceRange({ classId, fromDate, toDate }),
    onSuccess: (rows) => {
      const csv      = buildAttendanceCsv(rows, pupils);
      const blob     = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url      = URL.createObjectURL(blob);
      const filename = `attendance-${className}-${fromDate}-to-${toDate}.csv`;

      const a  = document.createElement('a');
      a.href   = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onClose();
    },
  });

  function handleExport() {
    setDateError('');
    if (!fromDate || !toDate) {
      setDateError('Both dates are required.');
      return;
    }
    if (fromDate > toDate) {
      setDateError('"From" date must be before "To" date.');
      return;
    }
    const diffDays = (new Date(toDate) - new Date(fromDate)) / 86400_000;
    if (diffDays > 93) {
      setDateError('Maximum export range is one term (93 days / ~13 weeks).');
      return;
    }
    exportMutation.mutate();
  }

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-s-4 bg-surface-0/80 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-[400px] bg-surface-2 border border-line-2 rounded-r-3 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-s-6 py-s-5 border-b border-line-1">
          <div>
            <h3 className="font-display text-[20px] text-ink-0">Export Attendance</h3>
            <p className="font-mono text-meta text-ink-3 mt-s-1">CSV download · opens in Excel / Google Sheets</p>
          </div>
          <button
            onClick={onClose}
            className="text-ink-4 hover:text-ink-1 text-[20px] leading-none transition-colors"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="px-s-6 py-s-5 space-y-s-5">
          <div className="grid grid-cols-2 gap-s-4">
            <label className="flex flex-col gap-s-2">
              <span className="font-mono text-meta uppercase tracking-[0.12em] text-ink-3">From</span>
              <input
                type="date"
                value={fromDate}
                max={today}
                onChange={(e) => setFromDate(e.target.value)}
                className="bg-surface-3 border border-line-2 rounded-r-2 px-s-3 py-s-3 text-[14px] text-ink-0 outline-none focus:border-gold-400 transition-colors"
              />
            </label>
            <label className="flex flex-col gap-s-2">
              <span className="font-mono text-meta uppercase tracking-[0.12em] text-ink-3">To</span>
              <input
                type="date"
                value={toDate}
                max={today}
                onChange={(e) => setToDate(e.target.value)}
                className="bg-surface-3 border border-line-2 rounded-r-2 px-s-3 py-s-3 text-[14px] text-ink-0 outline-none focus:border-gold-400 transition-colors"
              />
            </label>
          </div>

          {/* Date error */}
          {dateError && (
            <p className="text-[13px] text-red-400 bg-red-400/10 border border-red-400/20 rounded-r-2 px-s-3 py-s-2">
              {dateError}
            </p>
          )}

          {/* Fetch error */}
          {exportMutation.isError && (
            <p className="text-[13px] text-red-400 bg-red-400/10 border border-red-400/20 rounded-r-2 px-s-3 py-s-2">
              {exportMutation.error?.message ?? 'Could not load records. Try again.'}
            </p>
          )}

          {/* Format preview */}
          <div className="bg-surface-3 rounded-r-2 px-s-4 py-s-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3 mb-s-2">CSV format</p>
            <p className="font-mono text-[11px] text-ink-4 leading-relaxed">
              Pupil Name, Pupil Code, {fromDate}, … , {toDate}
              <br />
              "Adaeze Okafor", P001, present, … , absent
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-s-3 px-s-6 py-s-4 border-t border-line-1">
          <Button intent="ghost" onClick={onClose} disabled={exportMutation.isPending}>
            Cancel
          </Button>
          <Button
            intent="primary"
            onClick={handleExport}
            isLoading={exportMutation.isPending}
          >
            Download CSV
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Gradebook hub ─────────────────────────────────────────────────────────────

function GradebookHub() {
  const { schoolId } = useAuth();

  const { data: term } = useQuery({
    queryKey:  ['teacher', 'term', schoolId],
    queryFn:   () => simsService.getCurrentTerm(schoolId),
    enabled:   !!schoolId,
    staleTime: 10 * 60_000,
  });

  const { data: assessments, isLoading } = useQuery({
    queryKey:  ['teacher', 'assessments', term?.id],
    queryFn:   () => simsService.listAssessmentsForTeacher({ termId: term?.id }),
    enabled:   !!term?.id,
    staleTime: 60_000,
  });

  const pending   = (assessments ?? []).filter((a) => !a._hasScores);
  const completed = (assessments ?? []).filter((a) => a._hasScores);

  return (
    <AppShell title="Gradebook" navItems={NAV}>
      <div className="max-w-[820px]">
        <div className="mb-s-7">
          <div className="font-mono text-eyebrow uppercase text-gold-400">
            Gradebook · {term?.name ?? 'Current term'}
          </div>
          <h2 className="mt-s-3 font-display text-display-2 text-ink-0">
            Assessments.
          </h2>
          <p className="mt-s-3 text-body text-ink-2 max-w-[58ch]">
            All assessments for your classes this term.
            Click any row to enter scores.
          </p>
        </div>

        {isLoading && <Skeleton rows={5} />}

        {!isLoading && (assessments ?? []).length === 0 && (
          <Card className="bg-surface-2 border-line-2">
            <p className="text-body text-ink-2">
              No assessments for this term yet. Your head teacher or admin
              creates assessments; they appear here when assigned to your classes.
            </p>
          </Card>
        )}

        {(assessments ?? []).length > 0 && (
          <div className="space-y-s-6">
            {pending.length > 0 && (
              <AssessmentGroup title="Needs scores" assessments={pending} urgency="amber" />
            )}
            {completed.length > 0 && (
              <AssessmentGroup title="Scored" assessments={completed} urgency="neutral" />
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function AssessmentGroup({ title, assessments, urgency }) {
  return (
    <section>
      <div className="flex items-center gap-s-3 mb-s-4">
        <h3 className="font-display text-display-3 text-ink-0">{title}</h3>
        <Chip variant={urgency === 'amber' ? 'amber' : 'default'} size="sm">{assessments.length}</Chip>
      </div>
      <div className="bg-surface-2 border border-line-2 rounded-r-3 overflow-hidden">
        {assessments.map((a) => (
          <div key={a.id} className="flex items-center gap-s-4 px-s-4 py-s-3 border-b border-line-2 last:border-0 hover:bg-surface-3 transition-colors">
            <div className="flex-1 min-w-0">
              <div className="text-body text-ink-0 truncate">{a.title}</div>
              <div className="font-mono text-meta text-ink-3">
                {a.classes?.name} · {a.subject} · Max {a.max_score} marks
              </div>
              <div className="font-mono text-meta text-ink-3">
                Given: {a.given_on ? new Date(a.given_on).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }) : '—'}
              </div>
            </div>
            <Chip variant={a._hasScores ? 'green' : 'amber'} size="sm">
              {a._hasScores ? 'Scored' : 'No scores'}
            </Chip>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Reports hub ───────────────────────────────────────────────────────────────

function ReportsHub() {
  const { profile, schoolId } = useAuth();
  const [selectedClass, setSelectedClass] = useState(null);

  const { data: term } = useQuery({
    queryKey:  ['teacher', 'term', schoolId],
    queryFn:   () => simsService.getCurrentTerm(schoolId),
    enabled:   !!schoolId,
    staleTime: 10 * 60_000,
  });

  const { data: classes } = useQuery({
    queryKey:  ['teacher', 'classes', profile?.user_id],
    queryFn:   simsService.getMyClasses,
    staleTime: 5 * 60_000,
  });

  const { data: reportList, isLoading: reportsLoading } = useQuery({
    queryKey:  ['teacher', 'reports', selectedClass, term?.term_number, term?.academic_year],
    queryFn:   () => reportsService.listClassReports({
      classId: selectedClass,
      term:    term?.term_number,
      year:    term?.academic_year,
    }),
    enabled:   !!selectedClass && !!term,
    staleTime: 60_000,
  });

  return (
    <AppShell title="Reports" navItems={NAV}>
      <div className="max-w-[820px]">
        <div className="mb-s-7">
          <div className="font-mono text-eyebrow uppercase text-gold-400">Reports</div>
          <h2 className="mt-s-3 font-display text-display-2 text-ink-0">
            Term reports.
          </h2>
        </div>

        {/* Class picker */}
        <div className="mb-s-6">
          <label className="font-mono text-eyebrow uppercase text-ink-3 block mb-s-2">Class</label>
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

        {reportsLoading && <Skeleton rows={5} />}

        {!reportsLoading && selectedClass && reportList && (
          <div className="bg-surface-2 border border-line-2 rounded-r-3 overflow-hidden">
            {reportList.map(({ pupil, report }) => {
              const status = report?.status ?? 'not_started';
              const statusColor = {
                not_started:      'default',
                draft:            'amber',
                pending_approval: 'amber',
                approved:         'green',
                published:        'green',
              }[status] ?? 'default';

              return (
                <div key={pupil.id} className="flex items-center gap-s-4 px-s-4 py-s-3 border-b border-line-2 last:border-0 hover:bg-surface-3 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="text-body text-ink-0 truncate">{pupil.full_name}</div>
                    <div className="font-mono text-meta text-ink-3">{pupil.level}</div>
                  </div>
                  <Chip variant={statusColor} size="sm" dot={status !== 'not_started'}>
                    {status.replace(/_/g, ' ')}
                  </Chip>
                  {report && (
                    <button className="font-mono text-meta text-gold-400 hover:underline shrink-0">
                      Edit →
                    </button>
                  )}
                  {!report && (
                    <button className="font-mono text-meta text-ink-3 hover:text-gold-400 shrink-0">
                      Start →
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!selectedClass && (
          <Card className="bg-surface-2 border-line-2">
            <p className="text-body text-ink-2">Select a class above to see reports.</p>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

// ── Class card (dashboard) ────────────────────────────────────────────────────

function ClassCard({ cls, onAttendance, onGradebook }) {
  return (
    <Card className={`bg-surface-2 border-2 transition-colors ${
      cls.attendance_done ? 'border-line-2' : 'border-amber-400/30'
    }`}>
      <div className="flex items-start justify-between gap-s-4">
        <div className="flex-1 min-w-0">
          <div className="font-display text-[18px] text-ink-0">{cls.class_name}</div>
          <div className="font-mono text-meta text-ink-3 mt-s-1">
            {cls.level} · {cls.pupil_count} pupils
          </div>
          <div className="flex gap-s-2 mt-s-3 flex-wrap">
            <Chip variant={cls.attendance_done ? 'green' : 'amber'} dot size="sm">
              {cls.attendance_done ? 'Attendance done' : 'Attendance needed'}
            </Chip>
            {Number(cls.pending_scores) > 0 && (
              <Chip variant="amber" size="sm">
                {cls.pending_scores} assessment{cls.pending_scores !== 1 ? 's' : ''} to score
              </Chip>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-s-2 shrink-0">
          {!cls.attendance_done && (
            <Button intent="primary" size="sm" onClick={onAttendance}>
              Mark attendance
            </Button>
          )}
          {Number(cls.pending_scores) > 0 && (
            <Button intent="ghost" size="sm" onClick={onGradebook}>
              Enter scores
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Skeleton({ rows = 3 }) {
  return (
    <div className="space-y-s-4">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-20 rounded-r-2 bg-surface-2 border border-line-2 animate-pulse" />
      ))}
    </div>
  );
}

function formatDate(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-NG', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

function hour() {
  return new Date().getHours();
}

async function fetchDailySummary(teacherId) {
  const { data, error } = await supabase.rpc('get_teacher_daily_summary', {
    p_teacher_id: teacherId,
  });
  if (error) throw new Error(`Could not load summary: ${error.message}`);
  return data;
}

// Inline icon SVGs for the QuickActionCard tiles — no external dependency.
function CheckSvg() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6.5 10l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function BarSvg() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="3" y="10" width="3.5" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="8.25" y="6" width="3.5" height="11" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="13.5" y="3" width="3.5" height="14" rx="1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
function ClipSvg() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="12" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7.5 4V3.5A.5.5 0 0 1 8 3h4a.5.5 0 0 1 .5.5V4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 9h6M7 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function MsgSvg() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3 4.5A1.5 1.5 0 0 1 4.5 3h11A1.5 1.5 0 0 1 17 4.5v8A1.5 1.5 0 0 1 15.5 14H7l-4 3V4.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
