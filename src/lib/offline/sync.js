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
        await queue.markFailed(item.id, err?.message ?? 'Unknown error');
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
 */
export function startSyncEngine() {
  try {
    const safeRun = () => runSync().catch((e) => console.warn('[sync] runSync failed', e));
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
