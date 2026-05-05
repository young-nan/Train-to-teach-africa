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

let dbPromise = null;
function getDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('byCreated', 'createdAt');
        store.createIndex('byStatus', 'status');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
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
  const db = await getDb();
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
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(item);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  // Notify subscribers so the SyncPill ticks "Saved · syncing"
  notify();
  return item;
}

export async function pending() {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).index('byStatus').getAll('pending');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function remove(id) {
  const db = await getDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  notify();
}

export async function markFailed(id, errorMessage) {
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
      // The UI surfaces this in the admin "sync issues" tray.
      if (item.attempts >= 5) item.status = 'failed';
      store.put(item);
    };
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  notify();
}

// ---- Subscriber model — UI listens for queue changes ----------------------

const listeners = new Set();
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function notify() { listeners.forEach((l) => { try { l(); } catch (_) {} }); }
