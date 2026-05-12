/**
 * src/modules/admin/TermLocksView.jsx
 *
 * /app/admin/terms
 *
 * Lock and unlock terms. Locking freezes scores + comments for the term
 * so retroactive edits can't corrupt already-published reports.
 *
 * Only head_teacher / school_admin / super_admin can flip a lock —
 * enforced server-side via RLS.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import * as termLockService from '@/services/termLockService';
import { friendlyError } from '@/utils/friendlyError';

const TERM_LABEL = { term_1: 'First Term', term_2: 'Second Term', term_3: 'Third Term' };
const TERM_WINDOW = {
  term_1: 'Sep — Dec',
  term_2: 'Jan — Apr',
  term_3: 'Apr — Jul',
};

export function TermLocksView() {
  const { profile, user } = useAuth();
  const schoolId = profile?.school_id;
  const canEdit = ['head_teacher', 'school_admin', 'super_admin'].includes(profile?.role);

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  const qc = useQueryClient();
  const { data: locks, isLoading, error } = useQuery({
    queryKey: ['admin', 'term-locks', schoolId, year],
    queryFn: () => termLockService.listTermLocks({ schoolId, year }),
    enabled: !!schoolId,
    staleTime: 30_000,
  });

  return (
    <div className="max-w-[820px]">
      <div className="mb-s-7">
        <div className="font-mono text-eyebrow uppercase text-gold-400">Term locks</div>
        <h2 className="mt-s-3 font-display text-display-2 text-ink-0">
          Open and close school terms.
        </h2>
        <p className="mt-s-3 text-body text-ink-2 max-w-[58ch]">
          When a term is closed, teachers can no longer change scores or
          comments for that term. Reports already sent to parents stay stable.
          {!canEdit && ' Only head teachers and school admins can change lock state.'}
        </p>
      </div>

      {/* Year selector — for looking at prior years */}
      <div className="mb-s-5 flex items-center gap-s-3">
        <span className="font-mono text-eyebrow uppercase text-ink-3">Year</span>
        <select
          value={year}
          onChange={(e) => setYear(parseInt(e.target.value, 10))}
          className="bg-surface-3 border border-line-2 rounded-r-2 px-s-3 py-s-2 text-[14px] text-ink-1 outline-none focus:border-gold-400"
        >
          {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
            <option key={y} value={y}>{y}/{y + 1}</option>
          ))}
        </select>
      </div>

      {isLoading && <Skeleton />}
      {error && (
        <Card className="border-red-400/30 bg-red-400/[0.04]">
          <div className="text-red-400">{friendlyError(error)}</div>
        </Card>
      )}
      {locks && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-s-4">
          {locks.map((lock) => (
            <TermCard
              key={lock.term}
              lock={lock}
              year={year}
              schoolId={schoolId}
              userId={user?.id}
              canEdit={canEdit}
              onChange={() => qc.invalidateQueries({ queryKey: ['admin', 'term-locks', schoolId, year] })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TermCard({ lock, year, schoolId, userId, canEdit, onChange }) {
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reason, setReason] = useState('');

  const lockMutation = useMutation({
    mutationFn: () => termLockService.lockTerm({ schoolId, term: lock.term, year, userId }),
    onSuccess: onChange,
  });
  const unlockMutation = useMutation({
    mutationFn: () => termLockService.unlockTerm({ schoolId, term: lock.term, year, userId, reason }),
    onSuccess: () => {
      setReasonOpen(false);
      setReason('');
      onChange();
    },
  });

  const isLocked = lock.locked;

  return (
    <Card className={isLocked ? 'border-amber-400/30' : ''}>
      <div className="mb-s-4 flex items-start justify-between">
        <div>
          <div className="font-display text-display-3 text-ink-0">
            {TERM_LABEL[lock.term]}
          </div>
          <div className="font-mono text-meta text-ink-3 mt-s-1">
            {TERM_WINDOW[lock.term]}
          </div>
        </div>
        <Chip variant={isLocked ? 'amber' : 'green'} dot>
          {isLocked ? 'Closed' : 'Open'}
        </Chip>
      </div>

      {/* History */}
      <div className="text-[12px] text-ink-3 space-y-s-1 mb-s-4 min-h-[32px]">
        {lock.locked_at && (
          <div>Closed {formatDate(lock.locked_at)}</div>
        )}
        {lock.unlocked_at && (
          <div>Reopened {formatDate(lock.unlocked_at)}</div>
        )}
        {lock.unlock_reason && (
          <div className="italic">"{lock.unlock_reason}"</div>
        )}
      </div>

      {/* Actions */}
      {canEdit && !reasonOpen && (
        <div>
          {isLocked ? (
            <Button
              intent="ghost"
              size="md"
              onClick={() => setReasonOpen(true)}
              className="w-full"
            >
              Reopen this term
            </Button>
          ) : (
            <Button
              intent="primary"
              size="md"
              onClick={() => lockMutation.mutate()}
              isLoading={lockMutation.isPending}
              className="w-full"
            >
              Close this term
            </Button>
          )}
          {lockMutation.error && (
            <div className="text-[12px] text-red-400 mt-s-2">{friendlyError(lockMutation.error)}</div>
          )}
        </div>
      )}

      {/* Unlock requires a reason */}
      {canEdit && reasonOpen && (
        <div className="space-y-s-3">
          <label className="font-mono text-meta uppercase tracking-[0.14em] text-ink-3 block">
            Why are you reopening?
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="e.g. Correcting an exam score for two pupils"
            className="w-full bg-surface-3 border border-line-2 rounded-r-2 px-s-3 py-s-2 text-[13px] text-ink-1 outline-none focus:border-gold-400 resize-none"
          />
          {unlockMutation.error && (
            <div className="text-[12px] text-red-400">{friendlyError(unlockMutation.error)}</div>
          )}
          <div className="flex gap-s-2">
            <Button
              intent="ghost"
              size="sm"
              onClick={() => { setReasonOpen(false); setReason(''); }}
            >
              Cancel
            </Button>
            <Button
              intent="primary"
              size="sm"
              onClick={() => unlockMutation.mutate()}
              isLoading={unlockMutation.isPending}
              disabled={!reason.trim()}
            >
              Reopen
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('en-NG', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function Skeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-s-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="bg-surface-2 border border-line-1 rounded-r-3 h-[200px] animate-pulse" />
      ))}
    </div>
  );
}
