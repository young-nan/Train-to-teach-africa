/**
 * src/lib/offline/queue.js
 *
 * The offline-first sync queue.
 *
 * Design contract (from Design Documentation §05 · Handoff):
 *   - Every write commits to local storage FIRST, then queues for sync.
 *   - UI never blocks on network.
 *   - UI says exactly one of three things: "Synced" / "Saving" / "Offline".
 *   - Sync queue is idempotent and replayable.
 *   - Worst case: a record arrives twice on the server and dedupes.
 *     Never: a record is lost.
 *
 * Storage: IndexedDB (via the native browser API — no Dexie. Adding 25 KB
 * for syntactic sugar fights our 180 KB budget).
 */

const DB_NAME = 'tta-offline';
const DB_VERSION = 1;
const STORE = 'mutation_queue';

// In-memory fallback used when IndexedDB is unavailable (iOS Private mode,
// quota=0, blocked by the browser, etc). Writes still succeed; they just
// don't survive a tab close. Better than blocking the UI entirely.
const memoryQueue = new Map();
let useMemoryFallback = false;

let dbPromise = null;
function getDb() {
  if (useMemoryFallback) return Promise.reject(new Error('Using memory fallback'));
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    let req;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (e) {
      // Some browsers (iOS Safari in some configurations) throw
      // synchronously rather than via onerror.
      console.warn('[offline] IndexedDB open threw — falling back to memory', e);
      useMemoryFallback = true;
      return reject(e);
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('byCreated', 'createdAt');
        store.createIndex('byStatus', 'status');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      console.warn('[offline] IndexedDB open failed — falling back to memory', req.error);
      useMemoryFallback = true;
      reject(req.error);
    };
    req.onblocked = () => {
      console.warn('[offline] IndexedDB blocked — falling back to memory');
      useMemoryFallback = true;
      reject(new Error('IndexedDB blocked'));
    };
  });
  return dbPromise;
}

function uuid() {
  // crypto.randomUUID is in all evergreen browsers + low-end Android Chrome 92+.
  return crypto.randomUUID();
}

/**
 * Enqueue a mutation. Returns the queued mutation immediately so the UI
 * can render its optimistic effect.
 *
 * @param {object} mutation
 *   - kind: 'attendance' | 'scores' | 'assessment_attempt' | ...
 *   - payload: serialisable
 *   - service: name of the service function to call when sync runs
 */
export async function enqueue(mutation) {
  const item = {
    id: uuid(),
    kind: mutation.kind,
    payload: mutation.payload,
    service: mutation.service,
    idempotencyKey: mutation.idempotencyKey ?? uuid(),
    status: 'pending',
    attempts: 0,
    lastError: null,
    createdAt: Date.now(),
  };

  try {
    const db = await getDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(item);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    // IndexedDB unavailable — keep in memory. Same shape, same notify(),
    // same downstream sync. The cost is no persistence across tab close.
    memoryQueue.set(item.id, item);
  }

  // Notify subscribers so the SyncPill ticks "Saved · syncing"
  notify();
  return item;
}

export async function pending() {
  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).index('byStatus').getAll('pending');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    return Array.from(memoryQueue.values()).filter((i) => i.status === 'pending');
  }
}

export async function remove(id) {
  try {
    const db = await getDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    memoryQueue.delete(id);
  }
  notify();
}

export async function markFailed(id, errorMessage) {
  try {
    const db = await getDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const item = getReq.result;
        if (!item) return resolve();
        item.attempts += 1;
        item.lastError = errorMessage;
        // After 5 attempts we mark as 'failed' and stop retrying — needs human.
        if (item.attempts >= 5) item.status = 'failed';
        store.put(item);
      };
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    const item = memoryQueue.get(id);
    if (item) {
      item.attempts += 1;
      item.lastError = errorMessage;
      if (item.attempts >= 5) item.status = 'failed';
    }
  }
  notify();
}

// ---- Subscriber model — UI listens for queue changes ----------------------

const listeners = new Set();
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function notify() { listeners.forEach((l) => { try { l(); } catch (_) {} }); }
