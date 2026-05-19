/**
 * src/modules/parent/ParentCommsView.jsx
 *
 * /app/parent/messages
 *
 * Two-way messaging between parents and school.
 *
 * Layout:
 *   - Child tabs (if multiple children linked)
 *   - Chronological list of shared notes with type icon
 *   - Reply textarea inline below each note
 *   - Parent's own replies shown in thread underneath
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import * as commsService from '@/services/commsService';
import * as simsService from '@/services/simsService';
import { cn } from '@/utils/cn';
import { PARENT_NAV } from './parentNav';

export function ParentCommsView() {
  const [activeChildId, setActiveChildId] = useState(null);

  const { data: children } = useQuery({
    queryKey: ['parent', 'children'],
    queryFn:  () => simsService.getMyChildren(),
    staleTime: 300_000,
  });

  const activeChild = (children ?? []).find((c) => c.id === activeChildId) ?? children?.[0];

  return (
    <AppShell title="Messages" navItems={PARENT_NAV}>
      <div className="max-w-[780px]">
        <div className="mb-s-6">
          <div className="font-mono text-eyebrow uppercase text-gold-400">Messages</div>
          <h2 className="mt-s-2 font-display text-display-2 text-ink-0">
            Notes from school.
          </h2>
          <p className="mt-s-2 text-body text-ink-2 max-w-[52ch]">
            Notes your child's teacher has shared with you. You can reply
            directly and the teacher will see your response.
          </p>
        </div>

        {/* Child tabs */}
        {children && children.length > 1 && (
          <div className="flex flex-wrap gap-s-2 mb-s-5">
            {children.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveChildId(c.id)}
                className={cn(
                  'flex items-center gap-s-2 px-s-4 py-[6px] rounded-full border text-[13px] transition-all',
                  activeChild?.id === c.id
                    ? 'bg-gold-400/15 border-gold-400/40 text-gold-200'
                    : 'bg-surface-2 border-line-2 text-ink-2 hover:border-line-3',
                )}
              >
                <span className="w-[18px] h-[18px] rounded-full bg-surface-3 grid place-items-center font-mono text-[10px]">
                  {c.full_name?.[0]?.toUpperCase()}
                </span>
                {c.full_name?.split(' ')[0]}
              </button>
            ))}
          </div>
        )}

        {activeChild
          ? <ChildMessages child={activeChild} />
          : (!children || children.length === 0) && (
            <Card className="bg-surface-2 text-center py-s-9">
              <p className="text-body text-ink-3">No children linked yet.</p>
            </Card>
          )}
      </div>
    </AppShell>
  );
}

// ── Per-child message list ────────────────────────────────────────────────────

function ChildMessages({ child }) {
  const qc = useQueryClient();

  const commsQ = useQuery({
    queryKey: ['parent', 'comms', child.id],
    queryFn:  () => commsService.getMyChildComms(child.id),
    enabled:  !!child.id,
    staleTime: 60_000,
  });

  // Load all parent replies for this child, grouped by comms_id
  const repliesQ = useQuery({
    queryKey: ['parent', 'replies', child.id],
    queryFn:  () => commsService.getMyRepliesForPupil(child.id),
    enabled:  !!child.id,
    staleTime: 60_000,
  });

  const entries = commsQ.data ?? [];
  const repliesByComms = repliesQ.data ?? {};

  if (commsQ.isLoading) {
    return (
      <div className="space-y-s-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-r-3 bg-surface-2 border border-line-1 animate-pulse" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <Card className="bg-surface-2 border-line-2 text-center py-s-9">
        <div className="text-[32px] mb-s-3">📬</div>
        <h3 className="font-display text-display-3 text-ink-0">No messages yet.</h3>
        <p className="mt-s-3 text-body text-ink-3 max-w-[42ch] mx-auto">
          When {child.full_name?.split(' ')[0]}'s teacher shares a note with you, it will appear here.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-s-4">
      {entries.map((entry) => (
        <MessageThread
          key={entry.id}
          entry={entry}
          child={child}
          existingReplies={repliesByComms[entry.id] ?? []}
          onReplySent={() => {
            qc.invalidateQueries({ queryKey: ['parent', 'replies', child.id] });
          }}
        />
      ))}
    </div>
  );
}

// ── Single message + reply thread ─────────────────────────────────────────────

function MessageThread({ entry, child, existingReplies, onReplySent }) {
  const { profile } = useAuth();
  const [expanded,  setExpanded]  = useState(false);
  const [showReply, setShowReply] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [replyErr,  setReplyErr]  = useState('');

  const typeLabel = commsService.CONTACT_TYPE_LABEL?.[entry.contact_type] ?? 'Note';
  const icon      = commsService.CONTACT_TYPE_ICON?.[entry.contact_type]  ?? '📋';

  const sendReply = useMutation({
    mutationFn: () => commsService.sendParentReply({
      commsId:  entry.id,
      pupilId:  child.id,
      schoolId: entry.school_id ?? child.school_id,
      body:     replyBody,
    }),
    onSuccess: () => {
      setReplyBody('');
      setShowReply(false);
      setReplyErr('');
      onReplySent();
    },
    onError: (e) => setReplyErr(e.message),
  });

  const hasReplies = existingReplies.length > 0;

  return (
    <div className="bg-surface-2 border border-line-1 rounded-r-3 overflow-hidden">
      {/* Original note */}
      <div className="px-s-5 py-s-4">
        <div className="flex items-start gap-s-4">
          <div className="text-[20px] mt-[2px] shrink-0">{icon}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-s-3 flex-wrap mb-s-2">
              <Chip variant="default" size="sm">{typeLabel}</Chip>
              <span className="font-mono text-[11px] text-ink-4">
                {commsService.fmtContactDate?.(entry.created_at) ??
                  new Date(entry.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
              </span>
            </div>
            {entry.body && (
              <>
                <p className={cn(
                  'text-[14.5px] text-ink-1 leading-relaxed',
                  !expanded && 'line-clamp-3',
                )}>
                  {entry.body}
                </p>
                {entry.body.length > 180 && (
                  <button
                    onClick={() => setExpanded((v) => !v)}
                    className="mt-s-2 font-mono text-[12px] text-gold-400 hover:text-gold-200"
                  >
                    {expanded ? 'Show less' : 'Read more'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Existing replies */}
      {hasReplies && (
        <div className="border-t border-line-1 divide-y divide-line-1 bg-surface-3/30">
          {existingReplies.map((r) => (
            <div key={r.id} className="px-s-5 py-s-3 flex gap-s-3">
              <div className="w-[28px] h-[28px] rounded-full bg-gold-400/15 border border-gold-400/25 grid place-items-center font-mono text-[10px] text-gold-200 shrink-0">
                {profile?.full_name?.[0]?.toUpperCase() ?? 'P'}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-s-2 mb-[2px]">
                  <span className="text-[12px] font-medium text-ink-1">You</span>
                  <span className="font-mono text-[10px] text-ink-4">
                    {new Date(r.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
                <p className="text-[13.5px] text-ink-2 leading-relaxed">{r.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reply form */}
      <div className="border-t border-line-1 px-s-5 py-s-3">
        {!showReply ? (
          <button
            onClick={() => setShowReply(true)}
            className="font-mono text-[12px] text-gold-400 hover:text-gold-200 transition-colors"
          >
            ↩ Reply to school
          </button>
        ) : (
          <div className="space-y-s-3">
            <textarea
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Write your reply… teachers will see this."
              autoFocus
              className="w-full bg-surface-3 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[14px] text-ink-0 outline-none focus:border-gold-400 resize-none"
            />
            {replyErr && (
              <p className="text-[12px] text-red-400">{replyErr}</p>
            )}
            <div className="flex items-center gap-s-3">
              <Button
                intent="primary"
                size="sm"
                onClick={() => sendReply.mutate()}
                isLoading={sendReply.isPending}
                disabled={!replyBody.trim()}
              >
                Send reply
              </Button>
              <button
                onClick={() => { setShowReply(false); setReplyBody(''); setReplyErr(''); }}
                className="font-mono text-[12px] text-ink-3 hover:text-ink-1"
              >
                Cancel
              </button>
              <span className="ml-auto font-mono text-[10px] text-ink-4">
                {replyBody.length}/1000
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
