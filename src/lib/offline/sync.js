/**
 * src/lib/offline/sync.js
 *
 * Drains the offline mutation queue. Started once at app boot.
 *
 * Strategy:
 *   - Listen for `online` event + visibility change.
 *   - On trigger, pull pending mutations and call their associated service.
 *   - Backoff per item: 1s, 4s, 16s, 64s, 256s — then mark failed.
 *   - Idempotency keys prevent duplicate writes if a retry succeeds after
 *     the server has already accepted the original.
 */

import * as queue from './queue';
import * as simsService from '@/services/simsService';
import * as lessonService from '@/services/lessonService';
import * as gradebookService from '@/services/gradebookService';

const HANDLERS = {
  attendance: ({ payload, idempotencyKey }) =>
    simsService.markAttendanceBatch({ ...payload, idempotencyKey }),
  // Legacy single-assessment scores. Kept for any in-flight queue items.
  scores: ({ payload, idempotencyKey }) =>
    simsService.enterScores({ ...payload, idempotencyKey }),
  // New: multi-component gradebook scores (one column at a time).
  gradebook_scores: ({ payload, idempotencyKey }) =>
    gradebookService.saveColumnScores({ ...payload, idempotencyKey }),
  assessment_attempt: ({ payload }) =>
    lessonService.submitAssessmentAttempt(payload),
};

let running = false;

export async function runSync() {
  if (running) return;
  if (!navigator.onLine) return;
  running = true;
  try {
    const items = await queue.pending();
    for (const item of items) {
      const handler = HANDLERS[item.kind];
      if (!handler) {
        await queue.markFailed(item.id, `No handler for kind ${item.kind}`);
        continue;
      }
      const delay = backoffMs(item.attempts);
      if (Date.now() - item.createdAt < delay && item.attempts > 0) {
        // Not yet time to retry this item — skip until the next cycle.
        continue;
      }
      try {
        await handler(item);
        await queue.remove(item.id);
      } catch (err) {
        const msg = err?.message ?? 'Unknown error';
        // Log loudly. Silent failures here are the bug pattern I keep
        // running into — a score "saves" in the UI but never reaches the
        // database. Eruda console + browser DevTools both show this.
        console.error(`[sync] handler failed for kind=${item.kind}, attempts=${item.attempts}:`, msg, item);
        await queue.markFailed(item.id, msg);
      }
    }
  } finally {
    running = false;
  }
}

function backoffMs(attempts) {
  // 0 -> 0, 1 -> 1s, 2 -> 4s, 3 -> 16s, 4 -> 64s, 5 -> 256s
  if (attempts <= 0) return 0;
  return Math.pow(4, attempts - 1) * 1000;
}

/**
 * Wire up sync triggers. Call once at app boot from main.jsx.
 * Wrapped in a try/catch so a broken offline queue never blocks app boot.
 *
 * Triggers, in priority order:
 *   1. queue.subscribe — fires whenever enqueue/remove/markFailed runs.
 *      This is the critical one: a teacher's score lands in the queue
 *      and we run sync immediately, not 15 seconds later. Without this,
 *      "Saved at HH:MM" shows in the UI but the DB stays empty until
 *      the next interval.
 *   2. online — when network returns after offline.
 *   3. visibilitychange — when tab refocuses (catches device wake).
 *   4. setInterval — last-resort safety net (handles races where the
 *      queue subscribe didn't fire because runSync was already running).
 *   5. boot — drains anything left from the previous session.
 */
export function startSyncEngine() {
  try {
    // Light debounce — coalesces bursts of enqueues (e.g. typing through
    // 28 score fields with 1.5s auto-save windows). Without it, every
    // queued item fires its own runSync; runSync's `running` guard
    // protects correctness, but the spam is wasteful.
    let scheduled = null;
    const safeRun = () => runSync().catch((e) => console.warn('[sync] runSync failed', e));
    const scheduleRun = () => {
      if (scheduled) return;
      scheduled = setTimeout(() => {
        scheduled = null;
        if (navigator.onLine) safeRun();
      }, 200); // 200ms — fast enough to feel instant, slow enough to coalesce
    };

    queue.subscribe(scheduleRun);
    window.addEventListener('online', safeRun);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') safeRun();
    });
    setInterval(() => { if (navigator.onLine) safeRun(); }, 15_000);
    safeRun();
  } catch (e) {
    console.warn('[sync] could not start sync engine', e);
  }
}
