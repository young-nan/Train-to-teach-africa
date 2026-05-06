/**
 * src/hooks/useGradebook.js
 *
 * Local state for one column of a gradebook being edited.
 *
 * Per-field validation: each pupil's entry carries an `invalid` flag. The
 * field flips invalid when the typed value can't be parsed as a number
 * within [0, max_score]. We do NOT silently clamp anymore — silent clamp
 * looks like the field accepted the input but it didn't, which is worse
 * UX than a red border telling the teacher to fix it.
 *
 * Save is async and returns a promise so the auto-save hook can await it.
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
  const [grid, setGrid] = useState(() => buildInitialGrid(pupils, existingScores));
  const [error, setError] = useState(null);

  useEffect(() => {
    setGrid(buildInitialGrid(pupils, existingScores));
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [column?.id]);

  /**
   * Set the score from a raw input string. Validates without clamping.
   * Returns nothing — the grid state carries the validation result via
   * the `invalid` flag on the entry.
   */
  const setScore = useCallback((pupilId, raw) => {
    const max = column?.max_score ?? 100;
    let next = null;
    let invalid = false;

    if (raw === '' || raw === null || raw === undefined) {
      next = null;
      invalid = false;
    } else {
      const trimmed = String(raw).trim();
      const n = Number(trimmed);
      if (!Number.isFinite(n)) {
        // Non-numeric input — don't store it, but flag the field.
        next = null;
        invalid = true;
      } else if (n < 0 || n > max) {
        // Out of range — store the value verbatim so the user sees what
        // they typed, but flag invalid so they can correct.
        next = Math.round(n);
        invalid = true;
      } else {
        next = Math.round(n);
        invalid = false;
      }
    }

    setGrid((g) => ({
      ...g,
      [pupilId]: { score: next, invalid, dirty: true },
    }));
  }, [column?.max_score]);

  const counts = useMemo(() => {
    let entered = 0, dirty = 0, invalid = 0;
    for (const e of Object.values(grid)) {
      if (e.score !== null && e.score !== undefined && !e.invalid) entered++;
      if (e.dirty) dirty++;
      if (e.invalid) invalid++;
    }
    return { entered, dirty, invalid, total: Object.keys(grid).length };
  }, [grid]);

  /**
   * Save the current grid state. Called by both:
   *   - The auto-save hook (debounced after typing)
   *   - The explicit Save button (immediately, via flush())
   *
   * Skips invalid entries — they stay dirty and pending until corrected.
   * Returns a promise the caller can await.
   */
  const save = useCallback(async () => {
    if (!column?.id) return;
    setError(null);

    // Snapshot the grid at save time so concurrent edits don't corrupt the batch.
    const snapshot = grid;
    const scoresToSave = Object.entries(snapshot)
      .filter(([, e]) => e.dirty && !e.invalid && e.score !== null && e.score !== undefined)
      .map(([pupilId, e]) => ({
        pupilId,
        score: e.score,
        maxScore: column.max_score,
      }));

    if (scoresToSave.length === 0) return; // Nothing to save — fine.

    const idempotencyKey = crypto.randomUUID();

    try {
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

      // Clear dirty flags ONLY for the rows we actually saved (the snapshot
      // ones). Any pupils the teacher edited DURING the save remain dirty
      // and will be picked up by the next save cycle.
      const savedIds = new Set(scoresToSave.map((s) => s.pupilId));
      setGrid((current) => {
        const next = { ...current };
        for (const id of savedIds) {
          if (next[id]) next[id] = { ...next[id], dirty: false };
        }
        return next;
      });
    } catch (e) {
      setError(e?.message ?? 'Could not save scores');
      throw e; // Re-throw so the auto-save hook surfaces 'error' status.
    }
  }, [column, classId, grid]);

  return {
    grid, counts,
    setScore, save,
    error,
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
      invalid: false,
    };
  }
  return g;
}

