/**
 * src/modules/admin/WAInboxView.jsx
 *
 * /app/admin/wa-inbox
 *
 * School staff view of inbound WhatsApp messages from parents.
 * Messages arrive via the whatsapp-webhook edge function and are stored
 * in wa_inbound_messages. This view lets staff read them, mark them as
 * read, and link them to a pupil's comms thread.
 *
 * The view is read-focused — replies are sent by calling the parent
 * via WhatsApp directly (the app doesn't send outbound WhatsApp from
 * here; that's handled by the nightly digest and CommsView WhatsApp link).
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { cn } from '@/utils/cn';

// ── Root ──────────────────────────────────────────────────────────────────────

export function WAInboxView() {
  const { schoolId } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState('unread'); // 'unread' | 'all'

  const { data: messages, isLoading } = useQuery({
    queryKey: ['wa-inbox', schoolId, filter],
    queryFn: async () => {
      let q = supabase
        .from('wa_inbound_messages')
        .select(`
          id, received_at, from_number, body, message_type,
          read_at, read_by,
          parent_id, school_id,
          profiles:parent_id (full_name, phone)
        `)
        .eq('school_id', schoolId)
        .order('received_at', { ascending: false })
        .limit(100);

      if (filter === 'unread') {
        q = q.is('read_at', null);
      }

      const { data, error } = await q;
      if (error) throw new Error(`Could not load WA inbox: ${error.message}`);
      return data ?? [];
    },
    enabled: !!schoolId,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const markRead = useMutation({
    mutationFn: async (id) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('wa_inbound_messages')
        .update({ read_at: new Date().toISOString(), read_by: user?.id })
        .eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wa-inbox', schoolId] }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('wa_inbound_messages')
        .update({ read_at: new Date().toISOString(), read_by: user?.id })
        .eq('school_id', schoolId)
        .is('read_at', null);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wa-inbox', schoolId] }),
  });

  const unreadCount = (messages ?? []).filter((m) => !m.read_at).length;

  return (
    <div className="max-w-[820px]">
      <div className="mb-s-6 flex items-end justify-between gap-s-4 flex-wrap">
        <div>
          <div className="font-mono text-eyebrow uppercase text-gold-400">WhatsApp inbox</div>
          <h2 className="mt-s-2 font-display text-display-2 text-ink-0">
            Parent messages.
          </h2>
          <p className="mt-s-2 text-body text-ink-2 max-w-[52ch]">
            Inbound WhatsApp messages from parents. Mark as read when actioned.
          </p>
        </div>
        {unreadCount > 0 && filter === 'all' && (
          <Button
            intent="ghost"
            size="sm"
            onClick={() => markAllRead.mutate()}
            isLoading={markAllRead.isPending}
          >
            Mark all read
          </Button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-s-1 bg-surface-2 border border-line-2 rounded-r-2 p-[3px] w-fit mb-s-5">
        {[
          { id: 'unread', label: 'Unread' },
          { id: 'all',    label: 'All messages' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setFilter(t.id)}
            className={cn(
              'px-s-5 py-[6px] rounded-[6px] text-[13px] font-medium transition-all',
              filter === t.id ? 'bg-surface-4 text-ink-0 shadow-sm' : 'text-ink-3 hover:text-ink-1',
            )}
          >
            {t.label}
            {t.id === 'unread' && unreadCount > 0 && (
              <span className="ml-s-2 px-[6px] py-[1px] rounded-full bg-red-500 text-white text-[10px] font-bold">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-s-3">
          {[1,2,3].map((i) => (
            <div key={i} className="h-[80px] bg-surface-2 border border-line-1 rounded-r-3 animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && (messages ?? []).length === 0 && (
        <Card className="bg-surface-2 text-center py-s-9">
          <div className="text-[32px] mb-s-3">📬</div>
          <h3 className="font-display text-display-3 text-ink-0">
            {filter === 'unread' ? 'No unread messages' : 'No messages yet'}
          </h3>
          <p className="mt-s-2 text-body text-ink-3 max-w-[40ch] mx-auto">
            {filter === 'unread'
              ? 'All WhatsApp messages have been read.'
              : 'Inbound WhatsApp messages from parents will appear here.'}
          </p>
          {filter === 'unread' && (
            <button
              onClick={() => setFilter('all')}
              className="mt-s-4 font-mono text-[13px] text-gold-400 hover:text-gold-200"
            >
              View all messages →
            </button>
          )}
        </Card>
      )}

      {/* Message list */}
      {!isLoading && (messages ?? []).length > 0 && (
        <div className="space-y-s-3">
          {messages.map((msg) => (
            <WAMessageCard
              key={msg.id}
              msg={msg}
              onMarkRead={() => markRead.mutate(msg.id)}
              isMarkingRead={markRead.isPending && markRead.variables === msg.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Message card ──────────────────────────────────────────────────────────────

function WAMessageCard({ msg, onMarkRead, isMarkingRead }) {
  const isRead   = !!msg.read_at;
  const parentName = msg.profiles?.full_name ?? null;
  const whatsappLink = `https://wa.me/${msg.from_number.replace('+', '')}`;

  return (
    <div className={cn(
      'bg-surface-2 border rounded-r-3 px-s-5 py-s-4 transition-all',
      isRead ? 'border-line-1' : 'border-gold-400/30 bg-surface-2',
    )}>
      <div className="flex items-start gap-s-4">
        {/* WhatsApp indicator */}
        <div className="w-[36px] h-[36px] rounded-full bg-green-400/15 border border-green-400/25 grid place-items-center shrink-0 mt-[2px]">
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-green-400" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.847L.057 23.5l5.81-1.523A11.94 11.94 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.895 0-3.668-.502-5.2-1.378l-.373-.221-3.443.903.918-3.352-.242-.385A9.955 9.955 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
          </svg>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-s-3 flex-wrap mb-s-1">
            <span className="text-[14px] font-medium text-ink-0">
              {parentName ?? msg.from_number}
            </span>
            {parentName && (
              <span className="font-mono text-[11px] text-ink-4">{msg.from_number}</span>
            )}
            {!isRead && <Chip variant="gold" size="sm">New</Chip>}
            <span className="font-mono text-[11px] text-ink-4 ml-auto">
              {new Date(msg.received_at).toLocaleString('en-NG', {
                day: 'numeric', month: 'short',
                hour: '2-digit', minute: '2-digit',
              })}
            </span>
          </div>

          {/* Message body */}
          {msg.message_type === 'text' && msg.body && (
            <p className="text-[14px] text-ink-1 leading-relaxed">{msg.body}</p>
          )}
          {msg.message_type !== 'text' && (
            <p className="text-[13px] text-ink-3 italic">
              [{msg.message_type} message — open WhatsApp to view]
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-s-4 mt-s-3 flex-wrap">
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[12px] text-green-400 hover:text-green-300"
            >
              Reply in WhatsApp →
            </a>
            {!isRead && (
              <button
                onClick={onMarkRead}
                disabled={isMarkingRead}
                className="font-mono text-[12px] text-ink-3 hover:text-ink-1 transition-colors"
              >
                {isMarkingRead ? 'Marking…' : 'Mark as read'}
              </button>
            )}
            {isRead && (
              <span className="font-mono text-[11px] text-ink-4">
                Read {new Date(msg.read_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
