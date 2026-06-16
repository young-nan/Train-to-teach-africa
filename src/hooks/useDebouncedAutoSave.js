/**
 * src/hooks/useDebouncedAutoSave.js
 *
 * Generic debounced auto-save hook.
 *
 * Why not a per-field onBlur save:
 *   - Mobile keyboards close every time the user moves to the next field.
 *     Per-field onBlur in a 28-pupil gradebook = 28 separate writes, each
 *     a full HTTP round-trip. On 3G that's ~30 seconds of just network.
 *   - The naive per-field model also breaks if the teacher types a value
 *     and immediately taps Save — the save fires before the onBlur write
 *     completes, racing the persisted value.
 *
 * The contract:
 *   - Caller passes a `save` function.
 *   - Caller calls `markDirty()` whenever a value changes (any keystroke).
 *   - 1.5s after the last `markDirty()`, the save fires.
 *   - If the user calls `flush()` (e.g. taps a "Save now" button), the
 *     pending save fires immediately.
 *   - On unmount, any pending save flushes.
 *
 * Status surface for UI:
 *   - 'idle'   — no changes since last save (or never saved)
 *   - 'pending' — changes typed, save will fire when debounce settles
 *   - 'saving' — save in flight
 *   - 'saved'  — last save succeeded; reverts to 'idle' after a moment
 *   - 'error'  — last save failed; error string available
 */

import { useEffect, useRef, useState, useCallback } from 'react';

const DEFAULT_DELAY_MS = 1_500;

export function useDebouncedAutoSave({ save, delay = DEFAULT_DELAY_MS, enabled = true }) {
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [savedAt, setSavedAt] = useState(null);

  const timerRef = useRef(null);
  const saveRef = useRef(save);
  const inFlightRef = useRef(false);
  const dirtyRef = useRef(false);

  // Keep the ref to `save` up to date so the closure doesn't capture stale state.
  useEffect(() => { saveRef.current = save; }, [save]);

  const doSave = useCallback(async () => {
    if (inFlightRef.current) {
      // A save is already running; mark dirty so we re-fire after it settles.
      dirtyRef.current = true;
      return;
    }
    inFlightRef.current = true;
    dirtyRef.current = false;
    setStatus('saving');
    setError(null);
    try {
      await saveRef.current();
      setStatus('saved');
      setSavedAt(new Date());
      // Auto-fade 'saved' back to 'idle' after 2s so the indicator settles.
      setTimeout(() => setStatus((s) => (s === 'saved' ? 'idle' : s)), 2_000);
    } catch (e) {
      setError(e?.message ?? 'Could not save');
      setStatus('error');
    } finally {
      inFlightRef.current = false;
      // If something dirtied during the save, fire again.
      if (dirtyRef.current) {
        dirtyRef.current = false;
        doSave();
      }
    }
  }, []);

  const markDirty = useCallback(() => {
    if (!enabled) return;
    setStatus('pending');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      doSave();
    }, delay);
  }, [enabled, delay, doSave]);

  /**
   * Flush any pending save immediately. Called when the user taps an
   * explicit "Save now" button, or by the component on unmount.
   */
  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      await doSave();
    }
  }, [doSave]);

  // On unmount: if a save is pending, fire it. Critical — without this,
  // navigating away mid-debounce loses the teacher's last typed score.
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        // Fire and forget — the component is unmounting, we can't await.
        // This is best-effort. The offline queue (which is what `save`
        // ultimately calls into) means the write is durable anyway.
        saveRef.current?.();
      }
    };
  }, []);

  return { status, error, savedAt, markDirty, flush };
}
