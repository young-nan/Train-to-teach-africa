/**
 * src/components/ui/SyncPill.jsx
 *
 * The little status pill in the global header that tells the user one of
 * three things — and ONLY one of three things, per the design contract:
 *
 *   "Synced"                 — green dot, default state
 *   "Saving · n records"     — gold dot, queue is non-empty
 *   "Offline · changes safe" — amber dot, navigator says we're offline
 *
 * We deliberately do NOT show HTTP statuses, retry counts, error messages,
 * or any other technical detail. The Design Documentation calls this out as
 * a hard rule: schools cannot debug HTTP. They need confidence, not data.
 */

import { useEffect, useState, useSyncExternalStore } from 'react';
import * as queue from '@/lib/offline/queue';
import { Chip } from './Chip';

function subscribe(cb) { return queue.subscribe(cb); }
function getQueueLength() { return queue._snapshotLength?.() ?? 0; }
// Note: we read the live queue length on each subscriber notification by
// calling pending(). Keeping the snapshot in IndexedDB is async-only.

export function SyncPill() {
  const [count, setCount] = useState(0);
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      const items = await queue.pending();
      if (mounted) setCount(items.length);
    };
    refresh();
    const unsub = queue.subscribe(refresh);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      mounted = false;
      unsub();
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  if (!online) {
    return <Chip variant="amber" dot>Offline · changes safe</Chip>;
  }
  if (count > 0) {
    return <Chip variant="gold" dot>Saving · {count} {count === 1 ? 'record' : 'records'}</Chip>;
  }
  return <Chip variant="green" dot>Synced</Chip>;
}
