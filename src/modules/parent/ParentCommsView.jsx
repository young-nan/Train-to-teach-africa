/**
 * src/modules/parent/ParentCommsView.jsx
 *
 * /app/parent/messages
 *
 * Parents see notes that the school has explicitly shared with them.
 * Read-only in v1 — no reply flow. Two-way messaging is v2.
 *
 * Layout:
 *   - Child tabs (if multiple children linked)
 *   - Chronological list of shared notes with type icon + author
 *   - Empty state if the school hasn't shared anything yet
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { useAuth } from '@/hooks/useAuth';
import * as commsService from '@/services/commsService';
import * as simsService from '@/services/simsService';
import { cn } from '@/utils/cn';

const PARENT_NAV = [
  { to: '/app/parent',           label: 'Tonight',  end: true },
  { to: '/app/parent/children',  label: 'Children'            },
  { to: '/app/parent/lessons',   label: 'Lessons'             },
  { to: '/app/parent/reports',   label: 'Reports'             },
  { to: '/app/parent/messages',  label: 'Messages'            },
  { to: '/app/parent/billing',   label: 'Fees'                },
  { to: '/app/parent/subscribe', label: 'Subscribe'           },
];

export function ParentCommsView() {
  const [activeChild, setActiveChild] = useState(null);

  const childrenQ = useQuery({
    queryKey: ['parent', 'children'],
    queryFn:  () => simsService.getMyChildren(),
    staleTime: 300_000,
  });

  const children = childrenQ.data ?? [];
  const selectedId = activeChild ?? children[0]?.id ?? null;
  const selectedChild = children.find((c) => c.id === selectedId);

  return (
    <AppShell title="Messages" navItems={PARENT_NAV}>
      <div className="max-w-[820px]">
        <div className="mb-s-7">
          <div className="font-mono text-eyebrow uppercase text-gold-400">School messages</div>
          <h2 className="mt-s-2 font-display text-display-2 text-ink-0">
            Notes from school.
          </h2>
          <p className="mt-s-2 text-body text-ink-3 max-w-[58ch]">
            Notes and updates your child's school has shared with you.
          </p>
        </div>

        {childrenQ.isLoading && (
          <div className="space-y-s-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-r-2 bg-surface-2 animate-pulse"/>)}
          </div>
        )}

        {!childrenQ.isLoading && children.length === 0 && (
          <Card className="bg-surface-2 border-line-2 text-center">
            <p className="text-body text-ink-2">No children linked to your account yet.</p>
          </Card>
        )}

        {children.length > 0 && (
          <>
            {/* Child tabs */}
            {children.length > 1 && (
              <div className="flex flex-wrap gap-s-2 mb-s-6">
                {children.map((child) => (
                  <button
                    key={child.id}
                    onClick={() => setActiveChild(child.id)}
                    className={cn(
                      'px-s-5 py-s-2 rounded-full text-[13px] font-medium border transition-all duration-150',
                      child.id === selectedId
                        ? 'bg-gold-400/15 border-gold-400/40 text-gold-200'
                        : 'bg-surface-2 border-line-2 text-ink-2 hover:text-ink-1',
                    )}
                  >
                    {child.full_name?.split(' ')[0] ?? child.full_name}
                  </button>
                ))}
              </div>
            )}

            {selectedId && <ChildMessages pupilId={selectedId} child={selectedChild} />}
          </>
        )}
      </div>
    </AppShell>
  );
}

function ChildMessages({ pupilId, child }) {
  const commsQ = useQuery({
    queryKey: ['parent', 'comms', pupilId],
    queryFn:  () => commsService.getMyChildComms(pupilId),
    enabled:  !!pupilId,
    staleTime: 60_000,
  });

  const entries = commsQ.data ?? [];

  if (commsQ.isLoading) {
    return (
      <div className="space-y-s-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-r-2 bg-surface-2 animate-pulse"/>)}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <Card className="bg-surface-2 border-line-2 text-center py-s-9">
        <div className="text-[32px] mb-s-3">📬</div>
        <h3 className="font-display text-display-3 text-ink-0">No messages yet.</h3>
        <p className="mt-s-3 text-body text-ink-3 max-w-[42ch] mx-auto">
          When {child?.full_name?.split(' ')[0] ?? 'your child'}'s teacher shares a note with
          you, it will appear here.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-s-3">
      {entries.map((entry) => (
        <MessageCard key={entry.id} entry={entry} />
      ))}
    </div>
  );
}

function MessageCard({ entry }) {
  const [expanded, setExpanded] = useState(false);

  const typeLabel = commsService.CONTACT_TYPE_LABEL[entry.contact_type] ?? 'Note';
  const icon      = commsService.CONTACT_TYPE_ICON[entry.contact_type]  ?? '📋';

  return (
    <Card className="bg-surface-2 border-line-2">
      <div className="flex items-start gap-s-4">
        <div className="text-[22px] mt-[2px] shrink-0">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-s-3 flex-wrap mb-s-2">
            <Chip variant="default">{typeLabel}</Chip>
            <span className="font-mono text-[12px] text-ink-3">
              {commsService.fmtContactDate(entry.created_at)}
            </span>
          </div>

          {entry.body && (
            <>
              <p className={cn(
                'text-[14.5px] text-ink-1 leading-relaxed',
                !expanded && 'line-clamp-3'
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
    </Card>
  );
}
