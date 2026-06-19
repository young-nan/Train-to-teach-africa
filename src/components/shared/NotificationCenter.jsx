/**
 * NotificationCenter.jsx
 * Real-time notification dropdown connected to Supabase.
 * Listens to notifications table and shows badge count in the topbar.
 */

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/utils/cn';
import { Icon } from '@/components/ui/Icon';

const TYPE_META = {
  attendance:    { color: 'var(--c-rose-400)',    bg: 'rgba(251,113,133,0.12)', icon: 'calendar-stats'  },
  message:       { color: 'var(--c-sky-400)',     bg: 'rgba(59,130,246,0.12)',  icon: 'message-dots'    },
  intervention:  { color: 'var(--c-red-400)',     bg: 'rgba(239,83,80,0.12)',   icon: 'alert-triangle'  },
  assessment:    { color: 'var(--c-amber-400)',   bg: 'rgba(245,165,36,0.12)',  icon: 'clipboard-list'  },
  system:        { color: 'var(--c-teal-400)',    bg: 'rgba(34,184,166,0.12)',  icon: 'info-circle'     },
  fee:           { color: 'var(--c-gold-400)',    bg: 'rgba(229,166,42,0.12)', icon: 'receipt-2'       },
  announcement:  { color: 'var(--c-violet-400)',  bg: 'rgba(124,58,237,0.12)',  icon: 'speakerphone'    },
};

function timeAgo(isoString) {
  if (!isoString) return '';
  const diff = (Date.now() - new Date(isoString).getTime()) / 1000;
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function useNotifications(userId) {
  return useQuery({
    queryKey: ['notifications', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('notifications')
        .select('id, type, title, body, read, created_at, link')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) {
        // Table may not exist in all environments — return empty gracefully
        if (error.code === '42P01') return [];
        throw error;
      }
      return data ?? [];
    },
    enabled: !!userId,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function NotificationCenter() {
  const { user, role } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  const { data: notifications = [] } = useNotifications(userId);
  const unread = notifications.filter(n => !n.read).length;

  // Mark all read mutation
  const markAllRead = useMutation({
    mutationFn: async () => {
      if (!userId) return;
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false);
    },
    onSuccess: () => qc.invalidateQueries(['notifications', userId]),
  });

  const markOneRead = useMutation({
    mutationFn: async (id) => {
      await supabase.from('notifications').update({ read: true }).eq('id', id);
    },
    onSuccess: () => qc.invalidateQueries(['notifications', userId]),
  });

  // Real-time subscription
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifs-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => qc.invalidateQueries(['notifications', userId]),
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [userId, qc]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Fallback seed notifications when table is empty (dev / new accounts)
  const SEED = [
    { id:'s1', type:'system',       title:'Welcome to TTA EOS',             body:'Your dashboard is ready. Explore your role.',  read:false, created_at: new Date(Date.now()-3600e3).toISOString() },
    { id:'s2', type:'announcement', title:'Term 3 has started',             body:'Week 9 of 13. Stay on track with the curriculum.',read:true, created_at: new Date(Date.now()-86400e3).toISOString() },
    { id:'s3', type:'assessment',   title:'3 assessments pending scores',   body:'Primary 2A · Basic Science · Week 8.',           read:true, created_at: new Date(Date.now()-172800e3).toISOString() },
  ];
  const items = notifications.length > 0 ? notifications : SEED;
  const displayUnread = notifications.length > 0 ? unread : 1;

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => {
          setOpen(o => !o);
          if (!open && unread > 0) markAllRead.mutate();
        }}
        className="relative w-9 h-9 rounded-lg flex items-center justify-center text-[var(--c-ink-2)] hover:bg-[var(--c-surface-3)] transition-colors"
        aria-label={`Notifications${displayUnread > 0 ? ` (${displayUnread} unread)` : ''}`}
      >
        <Icon name="bell" size={20} />
        {displayUnread > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[7px] h-[7px] rounded-full bg-[var(--c-rose-400)] border-2 border-[var(--c-surface-1)]" />
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          className="absolute right-0 top-11 w-[360px] max-h-[520px] flex flex-col bg-[var(--c-surface-2)] border border-[var(--c-line-2)] rounded-2xl shadow-2xl overflow-hidden z-50 animate-fade-up"
          style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--c-line-1)]">
            <div className="font-heading font-semibold text-[14px] text-[var(--c-ink-0)]">
              Notifications
              {displayUnread > 0 && (
                <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--c-rose-400)] text-white">
                  {displayUnread}
                </span>
              )}
            </div>
            <button
              onClick={() => markAllRead.mutate()}
              className="text-[11px] text-[var(--product-accent)] hover:opacity-75 font-medium"
            >
              Mark all read
            </button>
          </div>

          {/* Items */}
          <div className="overflow-y-auto flex-1">
            {items.length === 0 ? (
              <div className="py-12 text-center">
                <Icon name="bell-off" size={32} className="text-[var(--c-ink-4)] mx-auto mb-3" />
                <p className="text-[13px] text-[var(--c-ink-3)]">All caught up!</p>
              </div>
            ) : (
              items.map(n => {
                const meta = TYPE_META[n.type] ?? TYPE_META.system;
                return (
                  <div
                    key={n.id}
                    onClick={() => { markOneRead.mutate(n.id); setOpen(false); }}
                    className={cn(
                      'flex gap-3 px-4 py-3.5 cursor-pointer border-b border-[var(--c-line-1)] last:border-0 transition-colors',
                      !n.read ? 'bg-[rgba(255,255,255,0.03)] hover:bg-[var(--c-surface-3)]' : 'hover:bg-[var(--c-surface-3)]',
                    )}
                  >
                    {/* Unread dot */}
                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: !n.read ? 'var(--product-accent)' : 'transparent' }} />

                    {/* Icon */}
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: meta.bg }}
                    >
                      <Icon name={meta.icon} size={15} style={{ color: meta.color }} />
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <div className={cn('text-[13px] truncate', !n.read ? 'font-semibold text-[var(--c-ink-0)]' : 'text-[var(--c-ink-1)]')}>
                        {n.title}
                      </div>
                      <div className="text-[11px] text-[var(--c-ink-3)] mt-0.5 line-clamp-2 leading-relaxed">
                        {n.body}
                      </div>
                    </div>

                    {/* Time */}
                    <div className="text-[10px] font-mono text-[var(--c-ink-4)] shrink-0 mt-0.5">
                      {timeAgo(n.created_at)}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-[var(--c-line-1)] text-center">
            <button
              className="text-[12px] text-[var(--product-accent)] hover:opacity-75 font-medium"
              onClick={() => setOpen(false)}
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
