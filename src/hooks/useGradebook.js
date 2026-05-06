/**
 * src/hooks/useGradebook.js
 *
 * Local state for one column of a gradebook being edited.
 *
 * The gradebook screen lets the teacher edit ONE column at a time
 * (e.g. "enter CA1 scores for everyone"). Multi-column simultaneous
 * editing was tempting but adds two failure modes:
 *   - the teacher half-fills CA1, switches to CA2, loses track of which
 *     they were saving
 *   - mobile keyboard handover between rows in different columns is
 *     awful — iOS in particular shows the wrong "next" button
 *
 * One column at a time. Saves are explicit. The teacher knows what
 * they're committing.
 *
 * Mirrors useAttendance closely — same dirty-tracking, same offline
 * queue, same idempotency. If you change one, change the other.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import * as queue from '@/lib/offline/queue';

/**
 * @param {object} args
 *   - column: { id, name, max_score, weight }
 *   - classId: the class
 *   - pupils: array of { id, full_name, photo_url, pupil_code }
 *   - existingScores: [{ pupil_id, score }] — pre-filled from server
 */
export function useGradebookColumn({ column, classId, pupils, existingScores = [] }) {
  // grid: { [pupilId]: { score: number | null, dirty: boolean } }
  const [grid, setGrid] = useState(() => buildInitialGrid(pupils, existingScores));
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [error, setError] = useState(null);

  // If the column changes (teacher switches CA1 → CA2), reset the grid
  // with the new column's existing scores.
  useEffect(() => {
    setGrid(buildInitialGrid(pupils, existingScores));
    setSavedAt(null);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [column?.id]);

  const setScore = useCallback((pupilId, raw) => {
    // Clamp to [0, max_score] and accept blank as null (not entered yet).
    const max = column?.max_score ?? 100;
    let next;
    if (raw === '' || raw === null || raw === undefined) {
      next = null;
    } else {
      const n = Number(raw);
      if (Number.isNaN(n)) return; // ignore garbage input — keep prior value
      next = Math.max(0, Math.min(max, Math.round(n)));
    }
    setGrid((g) => ({
      ...g,
      [pupilId]: { score: next, dirty: true },
    }));
  }, [column?.max_score]);

  const counts = useMemo(() => {
    let entered = 0, dirty = 0;
    for (const e of Object.values(grid)) {
      if (e.score !== null && e.score !== undefined) entered++;
      if (e.dirty) dirty++;
    }
    return { entered, dirty, total: Object.keys(grid).length };
  }, [grid]);

  const save = useCallback(async () => {
    if (!column?.id) return;
    setSaving(true);
    setError(null);
    try {
      const scoresToSave = Object.entries(grid)
        .filter(([, e]) => e.score !== null && e.score !== undefined)
        .map(([pupilId, e]) => ({
          pupilId,
          score: e.score,
          maxScore: column.max_score,
        }));

      if (scoresToSave.length === 0) {
        setError('No scores entered');
        return;
      }

      const idempotencyKey = crypto.randomUUID();
      await queue.enqueue({
        kind: 'gradebook_scores',
        service: 'gradebookService.saveColumnScores',
        payload: {
          columnId: column.id,
          classId,
          scores: scoresToSave,
        },
        idempotencyKey,
      });

      // Mark all as clean
      setGrid((g) => {
        const next = {};
        for (const [pid, e] of Object.entries(g)) {
          next[pid] = { ...e, dirty: false };
        }
        return next;
      });
      setSavedAt(new Date());
    } catch (e) {
      setError(e?.message ?? 'Could not save scores');
    } finally {
      setSaving(false);
    }
  }, [column, classId, grid]);

  return {
    grid, counts,
    setScore, save,
    saving, savedAt, error,
  };
}

function buildInitialGrid(pupils, existingScores) {
  const lookup = new Map((existingScores ?? []).map((s) => [s.pupil_id, s.score]));
  const g = {};
  for (const p of pupils) {
    const existing = lookup.get(p.id);
    g[p.id] = {
      score: existing ?? null,
      dirty: false,
    };
  }
  return g;
}
