/**
 * src/modules/sims/ReportEditor.jsx
 *
 * /app/teacher/reports/:classId/:term/:year/pupil/:pupilId
 *
 * The per-pupil report editor. Three sections:
 *   1. Snapshot (read-only): subject grid + attendance + overall %
 *   2. Comments: per-subject + overall (auto-saved)
 *   3. Conduct: 1-5 ratings (auto-saved)
 *   4. Actions: open print preview, submit for approval/publish
 */

import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { useDebouncedAutoSave } from '@/hooks/useDebouncedAutoSave';
import * as reportsService from '@/services/reportsService';
import { cn } from '@/utils/cn';

const TERM_LABEL = { term_1: 'Term 1', term_2: 'Term 2', term_3: 'Term 3' };

const CONDUCT_DIMENSIONS = [
  { key: 'punctuality', label: 'Punctuality' },
  { key: 'neatness', label: 'Neatness' },
  { key: 'effort', label: 'Effort' },
  { key: 'attentiveness', label: 'Attentiveness' },
  { key: 'cooperation', label: 'Cooperation' },
];

export function ReportEditor() {
  const { classId, term, year, pupilId } = useParams();
  const yearNum = parseInt(year, 10);
  const { user, profile } = useAuth();
  const qc = useQueryClient();

  const queryKey = ['report-data', pupilId, term, yearNum];
  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => reportsService.getReportData({ pupilId, term, year: yearNum }),
    enabled: !!(pupilId && term && yearNum),
    // staleTime: 0 + refetchOnMount: 'always' — the report editor is a
    // downstream view of data the teacher edits in the gradebook. Without
    // this, the editor keeps showing the cached empty subjects array even
    // after scores have been entered. Always fetching on mount adds one
    // round-trip per editor open, which is fine for this surface (teachers
    // only open the editor a handful of times per term).
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Local state for editable fields
  const [overallComment, setOverallComment] = useState('');
  const [conduct, setConduct] = useState({});

  // Hydrate local state from server data once (or when pupil/term changes)
  useEffect(() => {
    if (!data) return;
    setOverallComment(data.overall_comment?.comment ?? '');
    setConduct(data.conduct ?? {});
  }, [pupilId, term, yearNum]);

  // Ensure a draft envelope exists as soon as the editor opens
  useEffect(() => {
    if (!data?.school?.id || !data?.class?.id) return;
    if (!data.report_envelope) {
      reportsService.ensureDraft({
        pupilId, classId: data.class.id, schoolId: data.school.id, term, year: yearNum,
      }).then(() => qc.invalidateQueries({ queryKey })).catch(console.error);
    }
  }, [data?.report_envelope, data?.school?.id, data?.class?.id, pupilId, classId, term, yearNum]);

  // ---- Auto-save: overall comment -----------------------------------------
  const overallAutoSave = useDebouncedAutoSave({
    save: async () => {
      if (!overallComment?.trim()) return;
      await reportsService.savePupilComment({
        pupilId, term, year: yearNum, comment: overallComment.trim(), writtenBy: user.id,
      });
    },
    delay: 1_500,
  });

  // ---- Auto-save: conduct -------------------------------------------------
  const conductAutoSave = useDebouncedAutoSave({
    save: async () => {
      if (!Object.values(conduct).some((v) => v != null)) return;
      await reportsService.saveConductRatings({
        pupilId, term, year: yearNum, ratings: conduct, writtenBy: user.id,
      });
    },
    delay: 1_000,
  });

  // RULES OF HOOKS: useMemo must be called on every render, BEFORE any
  // conditional returns. The earlier shape of this file had useMemo after
  // `if (isLoading) return <Loading />` which crashed with React error #310
  // ("Rendered more hooks than during the previous render") the moment data
  // arrived. Compute against `data?.subjects ?? []` so it's safe when data
  // is undefined.
  const overall = useMemo(
    () => computeOverall(data?.subjects ?? []),
    [data?.subjects],
  );

  if (isLoading) return <Loading />;
  if (error) return <ErrorView message={error.message} />;
  if (!data) return <ErrorView message="No data found." />;

  const status = data.report_envelope?.status ?? 'draft';
  const reportId = data.report_envelope?.id;
  const printHref = `/app/teacher/reports/${classId}/${term}/${yearNum}/pupil/${pupilId}/print`;

  return (
    <div className="max-w-[820px] pb-s-10">
      <div className="mb-s-5">
        <Link to={`/app/teacher/reports/${classId}/${term}/${yearNum}`} className="text-[13.5px] text-ink-3 hover:text-ink-1">
          ← Back to class
        </Link>
      </div>

      {/* Pupil header */}
      <div className="flex items-start gap-s-4 mb-s-7">
        <div className="w-[64px] h-[64px] rounded-full bg-gold-400/10 border border-gold-400/30 grid place-items-center font-mono text-[18px] text-gold-200 shrink-0">
          {data.pupil.full_name.split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('')}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-mono text-eyebrow uppercase text-gold-400">{data.class?.name}</div>
          <h2 className="mt-s-2 font-display text-display-2 text-ink-0 truncate">
            {data.pupil.full_name}
          </h2>
          <p className="mt-s-1 font-mono text-meta text-ink-3">
            {TERM_LABEL[term]} {yearNum} · {data.pupil.pupil_code}
          </p>
        </div>
        <Chip variant={status === 'published' ? 'green' : status === 'draft' ? 'amber' : 'gold'} dot>
          {status.replace('_', ' ')}
        </Chip>
      </div>

      {/* Score snapshot */}
      <Card className="mb-s-5">
        <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-3">Snapshot</div>
        <div className="flex items-center gap-s-7 mb-s-5">
          <Stat label="Overall" value={`${overall.percentage}%`} bigger />
          <Stat label="Grade" value={overall.grade} bigger />
          <Stat label="Attendance" value={
            data.attendance.days_total > 0
              ? `${Math.round((data.attendance.days_present / data.attendance.days_total) * 100)}%`
              : '—'
          } />
          <Stat label="Subjects" value={data.subjects?.length ?? 0} />
        </div>
        {(data.subjects?.length ?? 0) === 0 && (
          <p className="text-[13px] text-amber-400">
            No scores have been entered for this term yet. Open the gradebook
            and enter scores before generating the report.
          </p>
        )}
      </Card>

      {/* Subject scores — read-only breakdown.
          Mirrors what'll appear on the printed report so the teacher can
          see exactly what they're commenting on. Edits happen in the
          gradebook, not here. */}
      {(data.subjects?.length ?? 0) > 0 && (
        <Card className="mb-s-5">
          <div className="flex items-center justify-between mb-s-4">
            <div className="font-mono text-eyebrow uppercase text-gold-400">Subject scores</div>
            <Link
              to={`/app/teacher/scores/grid?class_id=${data.class.id}&subject=${encodeURIComponent(data.subjects[0].subject)}&term=${term}&year=${yearNum}`}
              className="text-[12.5px] text-gold-200 hover:text-gold-50 underline-offset-4 hover:underline"
            >
              Edit in gradebook →
            </Link>
          </div>
          <SubjectScoreTable subjects={data.subjects} />
        </Card>
      )}

      {/* Overall comment */}
      <Card className="mb-s-5">
        <div className="flex items-center justify-between mb-s-4">
          <div className="font-mono text-eyebrow uppercase text-gold-400">Class teacher's comment</div>
          <SaveStatus status={overallAutoSave.status} savedAt={overallAutoSave.savedAt} error={overallAutoSave.error} />
        </div>
        <textarea
          value={overallComment}
          onChange={(e) => {
            setOverallComment(e.target.value);
            overallAutoSave.markDirty();
          }}
          rows={4}
          maxLength={1000}
          placeholder="Overall comment for this term — strengths, areas to improve, encouragement…"
          className="w-full bg-surface-3 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[14px] text-ink-1 outline-none focus:border-gold-400 resize-none"
        />
        <div className="font-mono text-meta text-ink-3 mt-s-2 text-right">
          {overallComment.length}/1000
        </div>
      </Card>

      {/* Conduct */}
      <Card className="mb-s-5">
        <div className="flex items-center justify-between mb-s-4">
          <div className="font-mono text-eyebrow uppercase text-gold-400">Conduct (1–5)</div>
          <SaveStatus status={conductAutoSave.status} savedAt={conductAutoSave.savedAt} error={conductAutoSave.error} />
        </div>
        <div className="space-y-s-3">
          {CONDUCT_DIMENSIONS.map((d) => (
            <ConductRow
              key={d.key}
              label={d.label}
              value={conduct[d.key] ?? null}
              onChange={(v) => {
                setConduct({ ...conduct, [d.key]: v });
                conductAutoSave.markDirty();
              }}
            />
          ))}
        </div>
      </Card>

      {/* Actions */}
      <Card>
        <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-3">Actions</div>
        <div className="flex flex-wrap gap-s-3">
          <a href={printHref} target="_blank" rel="noopener noreferrer">
            <Button intent="primary" size="md">Open print preview →</Button>
          </a>
          {status === 'draft' && reportId && (
            <Button
              intent="ghost" size="md"
              onClick={async () => {
                await reportsService.submitForApproval({ reportId, userId: user.id });
                qc.invalidateQueries({ queryKey });
              }}
            >
              Submit for approval
            </Button>
          )}
          {status === 'approved' && reportId && (
            <Button
              intent="ghost" size="md"
              onClick={async () => {
                await reportsService.publishReport({ reportId });
                qc.invalidateQueries({ queryKey });
              }}
            >
              Publish to parent
            </Button>
          )}
        </div>
        <p className="mt-s-4 text-[12.5px] text-ink-3">
          The print preview opens in a new tab. Use your browser's "Save as PDF"
          option in the print dialog to create a file you can email or send via WhatsApp.
        </p>
      </Card>
    </div>
  );
}

// ---- Small components -----------------------------------------------------

/**
 * Subject score breakdown — one row per subject with each column score
 * + computed total and letter grade. Read-only, mirrors the print layout
 * so what the teacher sees here is what the parent will see.
 *
 * Empty cells render as a dim em-dash, NOT zero. This matters: a teacher
 * mid-term shouldn't see "0/20" for unentered cells (looks like the pupil
 * scored zero) — they should see a placeholder that means "not yet".
 */
function SubjectScoreTable({ subjects }) {
  // Use the first subject's column names for headers — assumes all subjects
  // share the same component structure in a term, which matches Nigerian
  // primary convention (CA1/CA2/Exam everywhere).
  const headers = subjects[0]?.columns?.map((c) => c.name) ?? [];

  return (
    <div className="overflow-x-auto -mx-s-2 px-s-2">
      <table className="w-full text-[13.5px] border-collapse">
        <thead>
          <tr className="text-left">
            <th className="font-mono text-meta uppercase tracking-[0.14em] text-ink-3 pb-s-3 pr-s-4">Subject</th>
            {headers.map((h) => (
              <th key={h} className="font-mono text-meta uppercase tracking-[0.14em] text-ink-3 pb-s-3 px-s-3 text-center">{h}</th>
            ))}
            <th className="font-mono text-meta uppercase tracking-[0.14em] text-ink-3 pb-s-3 px-s-3 text-center">Total</th>
            <th className="font-mono text-meta uppercase tracking-[0.14em] text-ink-3 pb-s-3 pl-s-3 text-center">Grade</th>
          </tr>
        </thead>
        <tbody>
          {subjects.map((s) => {
            const total = computeSubjectTotal(s.columns);
            const hasAny = (s.columns ?? []).some((c) => c.score != null);
            return (
              <tr key={s.subject} className="border-t border-line-1">
                <td className="py-s-3 pr-s-4 text-ink-1">{s.subject}</td>
                {s.columns.map((c) => (
                  <td key={c.name} className="py-s-3 px-s-3 text-center font-mono tabular-nums">
                    {c.score != null ? (
                      <span className="text-ink-1">{c.score}<span className="text-ink-3 text-[11px]">/{c.max_score}</span></span>
                    ) : (
                      <span className="text-ink-3">—</span>
                    )}
                  </td>
                ))}
                <td className="py-s-3 px-s-3 text-center font-mono tabular-nums text-ink-0 font-medium">
                  {hasAny ? `${total.weighted.toFixed(1)}%` : <span className="text-ink-3">—</span>}
                </td>
                <td className="py-s-3 pl-s-3 text-center font-display text-[16px] text-ink-0">
                  {hasAny ? letterGrade(total.percentage) : <span className="text-ink-3">—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Stat({ label, value, bigger }) {
  return (
    <div>
      <div className="font-mono text-meta uppercase tracking-[0.14em] text-ink-3">{label}</div>
      <div className={cn(
        'mt-s-1 text-ink-0 font-display tabular-nums',
        bigger ? 'text-[28px] leading-none' : 'text-[20px] leading-none'
      )}>
        {value}
      </div>
    </div>
  );
}

function ConductRow({ label, value, onChange }) {
  return (
    <div className="flex items-center gap-s-3">
      <span className="text-[13.5px] text-ink-1 flex-1">{label}</span>
      <div className="flex gap-s-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n === value ? null : n)} // tap again to clear
            aria-label={`${label}: ${n} of 5`}
            className={cn(
              'w-[32px] h-[32px] rounded-full text-[13px] font-medium transition-all',
              value && n <= value
                ? 'bg-gold-400 text-[#1a1305]'
                : 'bg-surface-3 text-ink-3 border border-line-2 hover:border-line-3'
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

function SaveStatus({ status, savedAt, error }) {
  if (error) return <span className="text-[11px] font-mono text-red-400">Couldn't save</span>;
  if (status === 'saving') return <span className="text-[11px] font-mono text-gold-200">Saving…</span>;
  if (status === 'pending') return <span className="text-[11px] font-mono text-amber-400">…</span>;
  if (status === 'saved') return <span className="text-[11px] font-mono text-green-400">Saved</span>;
  return null;
}

function Loading() {
  return <div className="max-w-[820px] h-[400px] bg-surface-2 animate-pulse rounded-r-3" />;
}

function ErrorView({ message }) {
  return (
    <Card className="border-red-400/30 bg-red-400/[0.04] max-w-[820px]">
      <div className="font-display text-display-3 text-red-400">Could not load</div>
      <p className="mt-s-3 text-body text-ink-2">{message}</p>
    </Card>
  );
}

// ---- Pure helpers --------------------------------------------------------

/**
 * Per-subject calculation: sums the weighted contributions across all
 * entered columns. Returns:
 *   - raw, max: simple totals (raw points / max points across entered cols)
 *   - percentage: raw/max as %
 *   - weighted: the weight-aware total used for the term grade. If the
 *     subject's columns have weights summing to 100, this is the term %.
 *
 * Subjects with no entered scores yet return zeros — the caller decides
 * whether to render them (the score table shows em-dash; computeOverall
 * skips them).
 */
function computeSubjectTotal(columns = []) {
  let raw = 0;
  let max = 0;
  let weighted = 0;
  for (const c of columns) {
    if (c.score != null && c.max_score > 0) {
      raw += c.score;
      max += c.max_score;
      weighted += (c.score / c.max_score) * Number(c.weight ?? 0);
    }
  }
  const percentage = max > 0 ? (raw / max) * 100 : 0;
  return { raw, max, percentage, weighted };
}

function computeOverall(subjects) {
  if (subjects.length === 0) return { percentage: 0, grade: '—' };
  let totalWeighted = 0;
  let count = 0;
  for (const s of subjects) {
    const t = computeSubjectTotal(s.columns);
    if (t.max > 0) {
      totalWeighted += t.weighted;
      count++;
    }
  }
  const avg = count > 0 ? totalWeighted / count : 0;
  return { percentage: Math.round(avg), grade: letterGrade(avg) };
}

function letterGrade(percent) {
  if (percent >= 80) return 'A';
  if (percent >= 70) return 'B';
  if (percent >= 60) return 'C';
  if (percent >= 50) return 'D';
  if (percent >= 40) return 'E';
  return 'F';
}
