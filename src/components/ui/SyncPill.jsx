/**
 * src/components/ui/SyncPill.jsx
 *
 * The status pill in the global header. Four states:
 *
 *   "Synced"                 — green dot, default state
 *   "Saving · n records"     — gold dot, queue has pending items
 *   "Offline · changes safe" — amber dot, navigator says we're offline
 *   "Couldn't save · n"      — red dot, items exhausted retry budget
 *
 * The Design Documentation says: schools cannot debug HTTP, they need
 * confidence not data. We honour that for normal operation — no HTTP
 * codes, no retry counts. But when a write FAILS for good (5 retries
 * exhausted), the user needs to know. Otherwise the editor lies:
 * "Saved at HH:MM" when nothing was saved.
 *
 * Clicking the red pill opens a small panel with what failed and why.
 * The teacher can then take action — usually "ask the head teacher to
 * unlock the term."
 */

import { useEffect, useState, useRef } from 'react';
import * as queue from '@/lib/offline/queue';
import { Chip } from './Chip';

export function SyncPill() {
  const [pendingCount, setPendingCount] = useState(0);
  const [failedItems, setFailedItems] = useState([]);
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [panelOpen, setPanelOpen] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      try {
        const [pending, fails] = await Promise.all([queue.pending(), queue.failed()]);
        if (mounted) {
          setPendingCount(pending.length);
          setFailedItems(fails);
        }
      } catch (e) {
        if (mounted) {
          setPendingCount(0);
          setFailedItems([]);
        }
      }
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

  // Close panel on outside click
  useEffect(() => {
    if (!panelOpen) return;
    const onClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setPanelOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [panelOpen]);

  const failedCount = failedItems.length;

  if (failedCount > 0) {
    return (
      <div className="relative" ref={panelRef}>
        <button
          type="button"
          onClick={() => setPanelOpen((v) => !v)}
          aria-expanded={panelOpen}
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 rounded-full"
        >
          <Chip variant="red" dot>
            Couldn't save · {failedCount}
          </Chip>
        </button>
        {panelOpen && (
          <FailurePanel items={failedItems} onDismiss={async (id) => {
            await queue.dismissFailed(id);
            setFailedItems((items) => items.filter((i) => i.id !== id));
          }} />
        )}
      </div>
    );
  }

  if (!online) {
    return <Chip variant="amber" dot>Offline · changes safe</Chip>;
  }
  if (pendingCount > 0) {
    return <Chip variant="gold" dot>Saving · {pendingCount} {pendingCount === 1 ? 'record' : 'records'}</Chip>;
  }
  return <Chip variant="green" dot>Synced</Chip>;
}

function FailurePanel({ items, onDismiss }) {
  return (
    <div className="absolute right-0 top-[calc(100%+8px)] w-[360px] max-w-[calc(100vw-2rem)] bg-surface-2 border border-line-2 rounded-r-3 shadow-2xl z-50 overflow-hidden">
      <div className="px-s-4 py-s-3 border-b border-line-1 bg-red-400/[0.06]">
        <div className="font-display text-[15px] text-ink-0">Couldn't save these changes</div>
        <div className="text-[12px] text-ink-3 mt-s-1">
          {items.length} {items.length === 1 ? 'item' : 'items'} couldn't be saved after multiple tries.
        </div>
      </div>
      <div className="max-h-[320px] overflow-y-auto">
        {items.map((item) => (
          <FailureRow key={item.id} item={item} onDismiss={() => onDismiss(item.id)} />
        ))}
      </div>
    </div>
  );
}

function FailureRow({ item, onDismiss }) {
  const label = describeKind(item.kind);
  return (
    <div className="px-s-4 py-s-3 border-b border-line-1 last:border-0">
      <div className="flex items-start justify-between gap-s-3">
        <div className="flex-1 min-w-0">
          <div className="text-[13px] text-ink-1">{label}</div>
          {item.lastError && (
            <div className="text-[11.5px] text-red-400 mt-s-1 break-words">
              {item.lastError}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="text-ink-3 hover:text-ink-1 text-[12px] shrink-0"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

function describeKind(kind) {
  switch (kind) {
    case 'gradebook_scores': return 'Score entry';
    case 'attendance': return 'Attendance';
    case 'assessment_attempt': return 'Lesson attempt';
    case 'scores': return 'Legacy score';
    default: return kind ?? 'Unknown';
  }
}
