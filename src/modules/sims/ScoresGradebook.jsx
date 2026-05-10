/**
 * src/modules/sims/ScoresGradebook.jsx
 *
 * The gradebook entry screen at /app/teacher/scores/grid?class_id=&subject=&term=&year=
 *
 * Two states:
 *   - First time for this class+subject+term: show ScoresColumnSetup
 *   - Setup done: show the entry grid with one column tab at a time
 *
 * The entry view: tabs across the top (CA1, CA2, Exam), one column at a
 * time below. Each pupil row is name + score input + "/ max". Save button
 * at the bottom.
 *
 * One column at a time on purpose — see useGradebook for reasoning.
 */

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { useGradebookColumn } from '@/hooks/useGradebook';
import { useDebouncedAutoSave } from '@/hooks/useDebouncedAutoSave';
import { ScoresColumnSetup } from './ScoresColumnSetup';
import * as gradebookService from '@/services/gradebookService';
import * as simsService from '@/services/simsService';
import { cn } from '@/utils/cn';

export function ScoresGradebook() {
  const [searchParams] = useSearchParams();
  const classId = searchParams.get('class_id');
  const subject = searchParams.get('subject');
  const term = searchParams.get('term');
  const year = parseInt(searchParams.get('year'), 10);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: classes } = useQuery({
    queryKey: ['teacher', 'classes'],
    queryFn: () => simsService.getMyClasses(),
    staleTime: 5 * 60_000,
  });
  const cls = classes?.find((c) => c.id === classId);

  const gridKey = ['gradebook', classId, subject, term, year];
  const { data: grid, isLoading, error } = useQuery({
    queryKey: gridKey,
    queryFn: () => gradebookService.getGradebook({ classId, subject, term, year }),
    enabled: !!(classId && subject && term && year),
    staleTime: 30_000,
  });

  const setupMutation = useMutation({
    mutationFn: (columns) => gradebookService.createColumns({
      classId, subject, term, year, columns,
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: gridKey }),
  });

  // ---- Validate URL params --------------------------------------------------
  if (!classId || !subject || !term || !year) {
    return (
      <Card className="border-red-400/30 bg-red-400/[0.04]">
        <div className="font-display text-display-3 text-red-400">Missing parameters</div>
        <p className="mt-s-3 text-body text-ink-2">
          The gradebook URL is missing one of: class, subject, term, year.
        </p>
        <div className="mt-s-5">
          <Link to="/app/teacher/scores"><Button intent="ghost" size="md">← Back</Button></Link>
        </div>
      </Card>
    );
  }

  if (isLoading) return <LoadingState />;

  if (error) {
    return (
      <Card className="border-red-400/30 bg-red-400/[0.04]">
        <div className="font-display text-display-3 text-red-400">Could not load gradebook</div>
        <p className="mt-s-3 text-body text-ink-2">{error.message}</p>
      </Card>
    );
  }

  const hasColumns = (grid?.columns?.length ?? 0) > 0;

  if (!hasColumns) {
    return (
      <ScoresColumnSetup
        classMeta={cls}
        subject={subject}
        term={term}
        year={year}
        onSubmit={(columns) => setupMutation.mutate(columns)}
        submitting={setupMutation.isPending}
        error={setupMutation.error?.message}
      />
    );
  }

  return (
    <GradebookEntryView
      classId={classId}
      cls={cls}
      subject={subject}
      term={term}
      year={year}
      grid={grid}
      onBack={() => navigate('/app/teacher/scores')}
    />
  );
}

// ---------------------------------------------------------------------------

function GradebookEntryView({ classId, cls, subject, term, year, grid, onBack }) {
  const [activeColumnId, setActiveColumnId] = useState(grid.columns[0]?.id);
  const activeColumn = grid.columns.find((c) => c.id === activeColumnId);
  const qc = useQueryClient();

  // Pre-filter scores for the active column.
  const existingScores = useMemo(
    () => (grid.scores ?? []).filter((s) => s.gradebook_column_id === activeColumnId),
    [grid.scores, activeColumnId],
  );

  const {
    grid: rowGrid, counts, setScore, save: rawSave, error,
  } = useGradebookColumn({
    column: activeColumn,
    classId,
    pupils: grid.pupils,
    existingScores,
  });

  // Wrap save() so it invalidates the report-data query for any pupil whose
  // score just changed. Without this, the report editor and print preview
  // keep showing stale data — the gradebook says "saved" but the report
  // says "no scores entered." The cache key for report data uses pupilId,
  // so we invalidate broadly: any query starting with ['report-data'].
  const save = useCallback(async () => {
    await rawSave();
    // Fire-and-forget invalidation. If it fails (which it shouldn't), the
    // user still sees their save succeeded; downstream views will refetch
    // on next mount anyway thanks to refetchOnMount: 'always'.
    qc.invalidateQueries({ queryKey: ['report-data'] });
    // Also invalidate the gradebook grid so the next reopen shows the
    // saved scores rather than re-using the cached pre-save state.
    qc.invalidateQueries({ queryKey: ['gradebook', classId, subject, term, year] });
  }, [rawSave, qc, classId, subject, term, year]);

  // Auto-save: 1.5s after the last edit, or immediately when the teacher
  // taps "Save now" (which calls flush). The save() returned by the hook
  // batches all dirty rows in one offline-queue entry.
  const { status: saveStatus, savedAt, markDirty, flush } = useDebouncedAutoSave({
    save,
    delay: 1_500,
  });

  // Wrap setScore so every keystroke marks dirty and resets the debounce.
  const handleScoreChange = useCallback((pupilId, value) => {
    setScore(pupilId, value);
    markDirty();
  }, [setScore, markDirty]);

  const termLabel = ({ term_1: 'Term 1', term_2: 'Term 2', term_3: 'Term 3' }[term] ?? term);

  return (
    <div className="max-w-[820px]">
      {/* Sticky header with column tabs */}
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
              {cls?.name ?? 'Gradebook'} · {subject}
            </h2>
            <div className="font-mono text-meta text-ink-3 truncate">{termLabel} {year}</div>
          </div>
        </div>

        {/* Column tabs */}
        <div className="flex items-center gap-s-2 overflow-x-auto -mx-s-2 px-s-2 pb-s-1">
          {grid.columns.map((col) => (
            <ColumnTab
              key={col.id}
              column={col}
              active={col.id === activeColumnId}
              onClick={() => setActiveColumnId(col.id)}
            />
          ))}
        </div>
      </div>

      {/* Counts summary */}
      <div className="flex items-center gap-s-3 flex-wrap mt-s-5 mb-s-4 px-s-1">
        <Chip variant="gold" dot>
          {counts.entered} of {counts.total} entered
        </Chip>
        {counts.invalid > 0 && (
          <Chip variant="red" dot>
            {counts.invalid} invalid
          </Chip>
        )}
        {counts.dirty > 0 && counts.invalid === 0 && (
          <Chip variant="amber" dot>
            {counts.dirty} {counts.dirty === 1 ? 'change' : 'changes'} unsaved
          </Chip>
        )}
        <span className="ml-auto font-mono text-meta text-ink-3">
          Max: {activeColumn?.max_score} · Weight: {activeColumn?.weight}%
        </span>
      </div>

      {/* Pupil grid */}
      <div className="bg-surface-2 border border-line-1 rounded-r-3 mb-s-5 overflow-hidden">
        {grid.pupils.map((pupil) => {
          const entry = rowGrid[pupil.id] ?? { score: null, invalid: false };
          return (
            <PupilScoreRow
              key={pupil.id}
              pupil={pupil}
              score={entry.score}
              invalid={entry.invalid}
              maxScore={activeColumn?.max_score}
              onChange={(v) => handleScoreChange(pupil.id, v)}
            />
          );
        })}
      </div>

      {/* Sticky save bar — shows auto-save status, with explicit "Save now" */}
      <div className="sticky bottom-0 -mx-s-6 lg:-mx-s-9 px-s-6 lg:px-s-9 py-s-4 bg-surface-1/95 backdrop-blur-md border-t border-line-1">
        <div className="flex items-center gap-s-4 flex-wrap">
          <Button
            intent="primary"
            size="lg"
            onClick={flush}
            isLoading={saveStatus === 'saving'}
            className="flex-1 sm:flex-initial justify-center min-w-[180px]"
            disabled={counts.dirty === 0 || counts.invalid > 0}
          >
            Save {activeColumn?.name}
          </Button>
          <SaveStatusLine
            status={saveStatus}
            savedAt={savedAt}
            error={error}
            counts={counts}
          />
        </div>
      </div>
    </div>
  );
}

function SaveStatusLine({ status, savedAt, error, counts }) {
  // The status line tells the teacher what's happening with their data,
  // in plain language. Never shows raw HTTP. Never shows "synced" — that
  // word means something specific (the offline queue is drained), and the
  // SyncPill in the header already covers it.
  return (
    <div className="font-mono text-meta flex-1 min-w-0 truncate">
      {error && <span className="text-red-400">{error}</span>}
      {!error && status === 'saving' && <span className="text-gold-200">Saving…</span>}
      {!error && status === 'pending' && (
        <span className="text-amber-400">Will save in a moment…</span>
      )}
      {!error && status === 'saved' && savedAt && (
        <span className="text-green-400">
          Saved at {savedAt.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
      {!error && status === 'idle' && counts.invalid > 0 && (
        <span className="text-red-400">Fix invalid scores before saving</span>
      )}
      {!error && status === 'idle' && counts.invalid === 0 && counts.entered === 0 && (
        <span className="text-ink-3">Enter scores above — they'll save automatically</span>
      )}
      {!error && status === 'idle' && counts.invalid === 0 && counts.entered > 0 && counts.dirty === 0 && (
        <span className="text-ink-3">All caught up</span>
      )}
    </div>
  );
}

function ColumnTab({ column, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-s-4 py-s-3 rounded-r-2 text-[13px] font-medium whitespace-nowrap transition-all duration-150',
        'flex items-center gap-s-2 shrink-0',
        active
          ? 'bg-gold-400/15 border border-gold-400/40 text-gold-200'
          : 'bg-surface-2 border border-line-2 text-ink-2 hover:text-ink-1 hover:border-line-3',
      )}
    >
      <span>{column.name}</span>
      <span className="font-mono text-[10px] text-ink-3">/ {column.max_score}</span>
    </button>
  );
}

function PupilScoreRow({ pupil, score, invalid = false, maxScore, onChange }) {
  const initials = pupil.full_name.split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('') || '?';
  return (
    <div className={cn(
      'border-b border-line-1 last:border-0 flex items-center gap-s-4 px-s-4 py-s-3 min-h-[56px] transition-colors duration-150',
      // Subtle row tint when the row has an invalid value — quick visual scan
      // even when 28 pupils are visible.
      invalid && 'bg-red-400/[0.04]',
    )}>
      {pupil.photo_url ? (
        <img src={pupil.photo_url} alt="" className="w-[36px] h-[36px] rounded-full object-cover bg-surface-3 shrink-0" loading="lazy" />
      ) : (
        <div className="w-[36px] h-[36px] rounded-full bg-gold-400/10 border border-gold-400/25 grid place-items-center font-mono text-[12px] text-gold-200 shrink-0">
          {initials}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-[14.5px] text-ink-1 truncate">{pupil.full_name}</div>
        {pupil.pupil_code && (
          <div className="font-mono text-[10px] text-ink-3 tracking-[0.06em] truncate">{pupil.pupil_code}</div>
        )}
        {invalid && (
          <div className="font-mono text-[10px] text-red-400 mt-[2px]">
            Must be 0–{maxScore}
          </div>
        )}
      </div>
      <div className="flex items-center gap-s-2 shrink-0">
        <input
          // type="text" instead of type="number" on purpose. The browser's
          // built-in number validation strips values that exceed `max` —
          // e.target.value comes back empty when the user types 25 with
          // max=20, so our JS-level invalid flag never fires. Using text
          // + inputMode="numeric" gets us the numeric keypad on mobile
          // AND lets our setScore handler see what the user actually typed.
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={score ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="–"
          aria-invalid={invalid}
          className={cn(
            'w-[72px] h-[44px] bg-surface-3 rounded-r-2 px-s-3 text-[16px] text-ink-1 outline-none text-center font-mono tabular-nums transition-colors duration-150',
            'border',
            invalid
              ? 'border-red-400 focus:border-red-400'
              : 'border-line-2 focus:border-gold-400',
          )}
          aria-label={`Score for ${pupil.full_name}`}
        />
        <span className="font-mono text-[12px] text-ink-3 w-[24px]">/ {maxScore}</span>
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
