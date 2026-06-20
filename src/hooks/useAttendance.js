/**
 * src/hooks/useAttendance.js
 *
 * The state engine for one in-progress attendance register.
 *
 * Design decisions worth knowing:
 *
 *   - DEFAULT IS PRESENT. When the screen opens, every pupil is `present`.
 *     Paper teachers think this way; app teachers using "tap-each-pupil"
 *     workflows are still faster this way (tap 3 absentees vs tap 28 present).
 *
 *   - OPTIMISTIC. Tapping a status flips it locally and queues the write.
 *     The teacher never waits for the network. The SyncPill in the header
 *     shows when the queue is draining.
 *
 *   - IDEMPOTENT. Each register batch carries one idempotency_key (uuid).
 *     If the queue replays after a network hiccup, the upsert in the DB
 *     reuses the key — no duplicate rows.
 *
 *   - DIRTY TRACKING. We distinguish "marked by the teacher" from "default
 *     present" so the Save button can show "n changes" honestly. A teacher
 *     who closes the screen without touching anything HAS taken attendance
 *     (everyone present), but we don't claim 28 changes were made.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import * as queue from '@/lib/offline/queue';
import * as simsService from '@/services/simsService';

const STATUS = {
  PRESENT: 'present',
  ABSENT: 'absent',
  LATE: 'late',
};

/**
 * @param {object} args
 *   - classId: the class taking attendance
 *   - pupils: array of { id, full_name, photo_url, pupil_code }
 *   - date: ISO date string (YYYY-MM-DD), defaults to today
 */
export function useAttendance({ classId, pupils, date }) {
  const today = date ?? new Date().toISOString().slice(0, 10);

  // The register: { [pupilId]: { status, note?, dirty } }
  // `dirty` flips true the first time a teacher touches a row.
  const [register, setRegister] = useState(() => buildInitialRegister(pupils));
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [error, setError] = useState(null);
  const [existingLoaded, setExistingLoaded] = useState(false);

  // If there's already a register for today (teacher opened it earlier and
  // got distracted), we hydrate the local state from it. Without this, the
  // teacher would lose their afternoon edits when they reopen the screen.
  useEffect(() => {
    let cancelled = false;
    setExistingLoaded(false);
    simsService.getAttendanceForClass({ classId, date: today })
      .then((rows) => {
        if (cancelled) return;
        if (rows.length > 0) {
          setRegister((current) => {
            const next = { ...current };
            for (const row of rows) {
              next[row.pupil_id] = {
                status: row.status,
                note: row.note ?? '',
                dirty: false, // loaded from server, not a local edit
              };
            }
            return next;
          });
        }
        setExistingLoaded(true);
      })
      .catch(() => setExistingLoaded(true)); // fail-open — teacher can still mark
    return () => { cancelled = true; };
  }, [classId, today]);

  // -------- Mutators (called from PupilRow) --------------------------------

  const setStatus = useCallback((pupilId, status) => {
    setRegister((r) => ({
      ...r,
      [pupilId]: { ...(r[pupilId] ?? {}), status, dirty: true },
    }));
  }, []);

  const setNote = useCallback((pupilId, note) => {
    setRegister((r) => ({
      ...r,
      [pupilId]: { ...(r[pupilId] ?? {}), note, dirty: true },
    }));
  }, []);

  const markAllPresent = useCallback(() => {
    setRegister((r) => {
      const next = {};
      for (const pid of Object.keys(r)) {
        next[pid] = { ...r[pid], status: STATUS.PRESENT, dirty: true };
      }
      return next;
    });
  }, []);

  // -------- Counts for the summary header ----------------------------------

  const counts = useMemo(() => {
    let present = 0, absent = 0, late = 0, dirty = 0;
    for (const entry of Object.values(register)) {
      if (entry.status === STATUS.PRESENT) present++;
      else if (entry.status === STATUS.ABSENT) absent++;
      else if (entry.status === STATUS.LATE) late++;
      if (entry.dirty) dirty++;
    }
    return { present, absent, late, dirty, total: Object.keys(register).length };
  }, [register]);

  // -------- Save -----------------------------------------------------------

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const records = Object.entries(register).map(([pupilId, entry]) => ({
        pupilId,
        status: entry.status,
        note: entry.note || null,
      }));
      const idempotencyKey = crypto.randomUUID();

      // Always queue first. If we're online, the sync engine drains
      // immediately; if we're offline, the queue replays when network returns.
      // Either way, the teacher sees success right away.
      await queue.enqueue({
        kind: 'attendance',
        service: 'simsService.markAttendanceBatch',
        payload: { classId, date: today, records },
        idempotencyKey,
      });

      // Mark all rows clean — they're now persisted (or pending persist).
      setRegister((r) => {
        const next = {};
        for (const [pid, entry] of Object.entries(r)) {
          next[pid] = { ...entry, dirty: false };
        }
        return next;
      });
      setSavedAt(new Date());
    } catch (e) {
      setError(e?.message ?? 'Could not save register');
    } finally {
      setSaving(false);
    }
  }, [classId, today, register]);

  return {
    register,
    counts,
    setStatus,
    setNote,
    markAllPresent,
    save,
    saving,
    savedAt,
    error,
    isReady: existingLoaded,
    today,
  };
}

function buildInitialRegister(pupils) {
  const r = {};
  for (const p of pupils) {
    r[p.id] = { status: STATUS.PRESENT, note: '', dirty: false };
  }
  return r;
}

export const ATTENDANCE_STATUS = STATUS;
