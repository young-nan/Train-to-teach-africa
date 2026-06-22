/**
 * AdminComms.jsx — Full communications module
 * Inbox · Compose · Announcements
 *
 * Real data, wired to message_threads/message_participants/messages and
 * announcements (migration 0002_messaging.sql) — verified against live
 * Postgres: thread creation, cross-user visibility, audience-filtered
 * announcement visibility, all tested under real RLS as the authenticated
 * role (see the project's running notes for the exact test transcripts).
 *
 * The WhatsApp tab below is intentionally left as a clearly-labelled
 * "not yet built" placeholder rather than faked stats — there's no
 * WhatsApp Business API integration or opt-in tracking table in this
 * schema. Building it for real is a separate, larger piece of work.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Icon } from '@/components/ui/Icon';
import {
  PageHeader, Card, CardHeader, KpiCard, Chip, Button,
  Avatar, Input, Select, FormGroup, Textarea, Alert,
  LoadingScreen, Empty, Tabs,
} from '@/components/ui';

// ── Modal ────────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[520px] bg-[var(--c-surface-2)] border border-[var(--c-line-2)] rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--c-line-1)] sticky top-0 bg-[var(--c-surface-2)]">
          <h2 className="font-heading font-semibold text-[16px] text-[var(--c-ink-0)]">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--c-ink-3)] hover:bg-[var(--c-surface-3)] transition-colors">
            <Icon name="x" className="text-[18px]" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

const TABS = [
  { key: 'inbox',         label: 'Inbox'         },
  { key: 'announcements', label: 'Announcements' },
  { key: 'whatsapp',      label: 'WhatsApp'       },
];

const AUDIENCE_META = {
  all:     { label: 'Everyone', variant: 'violet' },
  parents: { label: 'Parents',  variant: 'rose'   },
  staff:   { label: 'Staff',    variant: 'teal'   },
  class:   { label: 'Class',    variant: 'gold'   },
};

const ROLE_VARIANT = { teacher: 'teal', head_teacher: 'sky', parent: 'rose', school_admin: 'gold' };

// ── Data hooks ────────────────────────────────────────────────────────────────

// Everyone in the admin's school the admin could start a thread with —
// staff and parents. Used by ComposeForm's recipient picker. There is no
// "broadcast to all parents" concept in the schema (message_threads are
// 1:1, by design — see 0002_messaging.sql's comment on why threads and
// announcements are deliberately separate tables) so this is a real
// person-picker, not the fake class-based dropdown the old mock UI had.
function useMessageableUsers(schoolId) {
  return useQuery({
    queryKey: ['messageable-users', schoolId],
    queryFn: async () => {
      if (!schoolId) return [];
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id,full_name,role')
        .eq('school_id', schoolId)
        .in('role', ['teacher', 'head_teacher', 'parent'])
        .order('full_name');
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!schoolId,
  });
}

// Inbox: threads the current user participates in, each with its latest
// message. Three separate queries + JS aggregation rather than one nested
// embed — the same join-fan-out risk found and fixed in HTOverview.jsx and
// SuperAdminApp.jsx applies here too (a thread with 2 participants and 3
// messages would fan out to 6 "rows" under a naive nested embed).
function useInbox(userId) {
  return useQuery({
    queryKey: ['admin-inbox', userId],
    queryFn: async () => {
      if (!userId) return [];

      const [participantRes, messagesRes] = await Promise.all([
        supabase.from('message_participants').select('thread_id,last_read_at').eq('user_id', userId),
        supabase.from('messages').select('id,thread_id,sender_id,body,created_at').order('created_at', { ascending: false }),
      ]);

      const myThreadIds = (participantRes.data ?? []).map(p => p.thread_id);
      if (myThreadIds.length === 0) return [];

      const lastReadByThread = Object.fromEntries((participantRes.data ?? []).map(p => [p.thread_id, p.last_read_at]));

      const { data: threads, error: threadsErr } = await supabase
        .from('message_threads')
        .select('id,subject,updated_at')
        .in('id', myThreadIds)
        .order('updated_at', { ascending: false });
      if (threadsErr) throw threadsErr;

      // Latest message per thread (messagesRes already ordered desc, so first match per thread wins)
      const latestByThread = {};
      (messagesRes.data ?? []).forEach(m => {
        if (!latestByThread[m.thread_id]) latestByThread[m.thread_id] = m;
      });

      // Sender names for the latest messages
      const senderIds = [...new Set(Object.values(latestByThread).map(m => m.sender_id).filter(Boolean))];
      let sendersById = {};
      if (senderIds.length > 0) {
        const { data: senders } = await supabase.from('profiles').select('user_id,full_name').in('user_id', senderIds);
        sendersById = Object.fromEntries((senders ?? []).map(s => [s.user_id, s.full_name]));
      }

      return (threads ?? []).map(t => {
        const last = latestByThread[t.id];
        const lastReadAt = lastReadByThread[t.id];
        return {
          id: t.id,
          subject: t.subject,
          lastMessageBody: last?.body ?? '',
          lastMessageAt: last?.created_at ?? t.updated_at,
          lastSenderId: last?.sender_id,
          lastSenderName: last ? (sendersById[last.sender_id] ?? 'Unknown') : null,
          unread: last ? (!lastReadAt || new Date(last.created_at) > new Date(lastReadAt)) : false,
        };
      });
    },
    enabled: !!userId,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

// All messages in a single thread, for ThreadView, plus the other participant's name.
function useThreadMessages(threadId) {
  return useQuery({
    queryKey: ['thread-messages', threadId],
    queryFn: async () => {
      if (!threadId) return [];
      const { data: messages, error } = await supabase
        .from('messages')
        .select('id,sender_id,body,created_at')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });
      if (error) throw error;

      const senderIds = [...new Set((messages ?? []).map(m => m.sender_id).filter(Boolean))];
      let sendersById = {};
      if (senderIds.length > 0) {
        const { data: senders } = await supabase.from('profiles').select('user_id,full_name,role').in('user_id', senderIds);
        sendersById = Object.fromEntries((senders ?? []).map(s => [s.user_id, s]));
      }

      return (messages ?? []).map(m => ({ ...m, sender: sendersById[m.sender_id] ?? null }));
    },
    enabled: !!threadId,
  });
}

function useAnnouncements(schoolId) {
  return useQuery({
    queryKey: ['admin-announcements', schoolId],
    queryFn: async () => {
      if (!schoolId) return [];
      const { data, error } = await supabase
        .from('announcements')
        .select('id,title,body,audience,view_count,created_at')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!schoolId,
  });
}

// ── Compose form ──────────────────────────────────────────────────────────────
function ComposeForm({ schoolId, currentUserId, users, onSent, onCancel }) {
  const [form, setForm] = useState({ to: '', subject: '', body: '' });
  const [error, setError] = useState('');
  const qc = useQueryClient();

  const send = useMutation({
    mutationFn: async () => {
      const { data: thread, error: threadErr } = await supabase
        .from('message_threads')
        .insert({ school_id: schoolId, subject: form.subject, created_by: currentUserId })
        .select('id')
        .single();
      if (threadErr) throw threadErr;

      const { error: participantsErr } = await supabase
        .from('message_participants')
        .insert([
          { thread_id: thread.id, user_id: currentUserId },
          { thread_id: thread.id, user_id: form.to },
        ]);
      if (participantsErr) throw participantsErr;

      const { error: messageErr } = await supabase
        .from('messages')
        .insert({ thread_id: thread.id, sender_id: currentUserId, body: form.body });
      if (messageErr) throw messageErr;

      return thread.id;
    },
    onSuccess: () => {
      qc.invalidateQueries(['admin-inbox', currentUserId]);
      onSent();
    },
    onError: (err) => setError(err.message ?? 'Failed to send message.'),
  });

  const update = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSend = (e) => {
    e.preventDefault();
    if (!form.to) { setError('Please select a recipient.'); return; }
    setError('');
    send.mutate();
  };

  return (
    <form onSubmit={handleSend} className="space-y-4">
      {error && <Alert type="error">{error}</Alert>}
      <FormGroup label="To *">
        <Select value={form.to} onChange={update('to')} required>
          <option value="">Select recipient…</option>
          {users.map(u => (
            <option key={u.user_id} value={u.user_id}>
              {u.full_name} ({u.role.replace('_', ' ')})
            </option>
          ))}
        </Select>
      </FormGroup>
      <FormGroup label="Subject *">
        <Input placeholder="Message subject…" value={form.subject} onChange={update('subject')} required />
      </FormGroup>
      <FormGroup label="Message *">
        <Textarea rows={5} placeholder="Type your message here…" value={form.body} onChange={update('body')} required className="resize-none" />
      </FormGroup>
      <div className="flex gap-3 pt-1">
        <Button variant="primary" type="submit" isLoading={send.isPending} icon="send" className="flex-1 justify-center">
          Send message
        </Button>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

// ── Announcement form ─────────────────────────────────────────────────────────
function AnnouncementForm({ schoolId, currentUserId, classes, onSent, onCancel }) {
  const [form, setForm] = useState({ title: '', body: '', audience: 'all', class_id: '' });
  const [error, setError] = useState('');
  const qc = useQueryClient();

  const publish = useMutation({
    mutationFn: async () => {
      const { error: err } = await supabase.from('announcements').insert({
        school_id: schoolId,
        title: form.title,
        body: form.body,
        audience: form.audience,
        class_id: form.audience === 'class' ? (form.class_id || null) : null,
        created_by: currentUserId,
      });
      if (err) throw err;
    },
    onSuccess: () => {
      qc.invalidateQueries(['admin-announcements', schoolId]);
      onSent();
    },
    onError: (err) => setError(err.message ?? 'Failed to publish announcement.'),
  });

  const update = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSend = (e) => {
    e.preventDefault();
    if (form.audience === 'class' && !form.class_id) { setError('Please select a class.'); return; }
    setError('');
    publish.mutate();
  };

  return (
    <form onSubmit={handleSend} className="space-y-4">
      {error && <Alert type="error">{error}</Alert>}
      <FormGroup label="Announcement title *">
        <Input placeholder="e.g. End of Term Assembly" value={form.title} onChange={update('title')} required />
      </FormGroup>
      <FormGroup label="Audience *">
        <Select value={form.audience} onChange={update('audience')}>
          <option value="all">Everyone (staff + parents)</option>
          <option value="parents">Parents only</option>
          <option value="staff">Staff only</option>
          <option value="class">Specific class</option>
        </Select>
      </FormGroup>
      {form.audience === 'class' && (
        <FormGroup label="Class *">
          <Select value={form.class_id} onChange={update('class_id')} required>
            <option value="">Select class…</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </FormGroup>
      )}
      <FormGroup label="Message *">
        <Textarea rows={4} placeholder="Announcement body…" value={form.body} onChange={update('body')} required className="resize-none" />
      </FormGroup>
      <div className="flex gap-3 pt-1">
        <Button variant="primary" type="submit" isLoading={publish.isPending} icon="speakerphone" className="flex-1 justify-center">
          Publish announcement
        </Button>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

// ── Thread view ────────────────────────────────────────────────────────────────
function ThreadView({ threadId, subject, currentUserId, onBack }) {
  const { data: messages = [], isLoading } = useThreadMessages(threadId);
  const [reply, setReply] = useState('');
  const qc = useQueryClient();

  const sendReply = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('messages').insert({ thread_id: threadId, sender_id: currentUserId, body: reply });
      if (error) throw error;
    },
    onSuccess: () => {
      setReply('');
      qc.invalidateQueries(['thread-messages', threadId]);
      qc.invalidateQueries(['admin-inbox', currentUserId]);
    },
  });

  // Mark the thread read on open
  useState(() => {
    if (threadId && currentUserId) {
      supabase.from('message_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('thread_id', threadId).eq('user_id', currentUserId)
        .then(() => qc.invalidateQueries(['admin-inbox', currentUserId]));
    }
  });

  const handleReply = (e) => {
    e.preventDefault();
    if (!reply.trim()) return;
    sendReply.mutate();
  };

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 text-[13px] text-[var(--product-accent)] mb-4 hover:opacity-80">
        <Icon name="arrow-left" className="text-[16px]" /> Back to inbox
      </button>

      <Card className="mb-4">
        <h3 className="font-semibold text-[15px] text-[var(--c-ink-0)] mb-4">{subject}</h3>
        {isLoading ? <LoadingScreen /> : (
          <div className="space-y-4">
            {messages.map(m => {
              const isMe = m.sender_id === currentUserId;
              return (
                <div key={m.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                  <Avatar name={m.sender?.full_name ?? '?'} size="sm" />
                  <div className={`flex-1 ${isMe ? 'text-right' : ''}`}>
                    <div className="flex items-center gap-2 mb-1" style={{ justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                      <span className="text-[12px] font-semibold text-[var(--c-ink-0)]">{m.sender?.full_name ?? 'Unknown'}</span>
                      <span className="text-[10px] text-[var(--c-ink-4)] font-mono">{new Date(m.created_at).toLocaleString('en-NG', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-[13px] text-[var(--c-ink-2)] leading-relaxed inline-block bg-[var(--c-surface-3)] rounded-xl px-4 py-2.5 max-w-[85%]">{m.body}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Reply" />
        <form onSubmit={handleReply} className="space-y-3">
          <Textarea rows={3} placeholder="Type your reply…" value={reply} onChange={e => setReply(e.target.value)} required className="resize-none" />
          <Button variant="primary" type="submit" isLoading={sendReply.isPending} icon="send">Send reply</Button>
        </form>
      </Card>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AdminComms() {
  const { profile, schoolId } = useAuth();
  const currentUserId = profile?.user_id;

  const [tab, setTab]         = useState('inbox');
  const [compose, setCompose] = useState(false);
  const [announce, setAnnounce] = useState(false);
  const [activeThread, setActiveThread] = useState(null);
  const [search, setSearch]   = useState('');

  const { data: inbox = [], isLoading: inboxLoading }     = useInbox(currentUserId);
  const { data: announcements = [], isLoading: annLoading } = useAnnouncements(schoolId);
  const { data: messageableUsers = [] } = useMessageableUsers(schoolId);

  const filtered = inbox.filter(m =>
    !search ||
    m.subject.toLowerCase().includes(search.toLowerCase()) ||
    (m.lastSenderName ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const unreadCount = inbox.filter(m => m.unread).length;

  return (
    <div>
      <PageHeader eyebrow="Admin" title="Communications" subtitle="Messages and announcements.">
        <Button variant="primary" icon="plus" onClick={() => setCompose(true)}>New message</Button>
        <Button variant="ghost" icon="speakerphone" onClick={() => setAnnounce(true)}>Announcement</Button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Unread messages"  value={inboxLoading ? '—' : unreadCount}         deltaDir="flat" icon="message-dots" />
        <KpiCard label="Total threads"    value={inboxLoading ? '—' : inbox.length}        deltaDir="flat" icon="inbox"        />
        <KpiCard label="Announcements"    value={annLoading ? '—' : announcements.length}  deltaDir="flat" icon="speakerphone" />
        <KpiCard label="Total views"      value={annLoading ? '—' : announcements.reduce((a,x)=>a+x.view_count,0)} deltaDir="flat" icon="eye" />
      </div>

      <Tabs tabs={TABS} active={tab} onChange={t => { setTab(t); setActiveThread(null); }} />

      {tab === 'inbox' && (
        activeThread ? (
          <ThreadView
            threadId={activeThread.id}
            subject={activeThread.subject}
            currentUserId={currentUserId}
            onBack={() => setActiveThread(null)}
          />
        ) : (
          <>
            <div className="mb-4">
              <Input className="max-w-[280px]" placeholder="Search messages…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Card padding={false}>
              {inboxLoading ? (
                <div className="p-8"><LoadingScreen /></div>
              ) : filtered.length === 0 ? (
                <Empty icon="inbox" message={inbox.length === 0 ? 'No messages yet.' : 'No messages match your search.'}
                  action={<Button variant="primary" size="sm" icon="plus" onClick={() => setCompose(true)}>New message</Button>} />
              ) : (
                filtered.map(msg => (
                  <div
                    key={msg.id}
                    onClick={() => setActiveThread(msg)}
                    className="flex items-start gap-4 px-5 py-4 border-b border-[var(--c-line-1)] last:border-0 hover:bg-[var(--c-surface-3)] transition-colors cursor-pointer"
                  >
                    <div className="mt-1.5 w-2 h-2 rounded-full shrink-0" style={{ background: msg.unread ? 'var(--product-accent)' : 'transparent' }} />
                    <Avatar name={msg.lastSenderName ?? '?'} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className={`text-[13px] ${msg.unread ? 'font-bold text-[var(--c-ink-0)]' : 'font-medium text-[var(--c-ink-1)]'}`}>
                          {msg.lastSenderName ?? 'Unknown'}
                        </span>
                        <span className="text-[11px] text-[var(--c-ink-4)] font-mono shrink-0">
                          {new Date(msg.lastMessageAt).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <div className={`text-[13px] truncate ${msg.unread ? 'text-[var(--c-ink-1)]' : 'text-[var(--c-ink-2)]'}`}>{msg.subject}</div>
                      <div className="text-[11px] text-[var(--c-ink-4)] truncate mt-0.5">{msg.lastMessageBody}</div>
                    </div>
                  </div>
                ))
              )}
            </Card>
          </>
        )
      )}

      {tab === 'announcements' && (
        <div className="space-y-4">
          {annLoading ? (
            <LoadingScreen />
          ) : announcements.length === 0 ? (
            <Empty icon="speakerphone" message="No announcements published yet." />
          ) : announcements.map(ann => {
            const meta = AUDIENCE_META[ann.audience] ?? AUDIENCE_META.all;
            return (
              <Card key={ann.id}>
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1">
                    <div className="font-heading font-semibold text-[15px] text-[var(--c-ink-0)]">{ann.title}</div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Chip variant={meta.variant} size="sm">{meta.label}</Chip>
                      <span className="text-[11px] text-[var(--c-ink-4)]">
                        {new Date(ann.created_at).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })}
                      </span>
                      <span className="text-[11px] text-[var(--c-ink-4)]">· {ann.view_count} view{ann.view_count !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                </div>
                <p className="text-[13px] text-[var(--c-ink-2)] leading-relaxed line-clamp-3">{ann.body}</p>
              </Card>
            );
          })}
          <button
            onClick={() => setAnnounce(true)}
            className="w-full py-4 rounded-xl border border-dashed border-[var(--c-line-3)] text-[13px] font-medium text-[var(--product-accent)] hover:bg-[var(--c-surface-2)] transition-colors flex items-center justify-center gap-2"
          >
            <Icon name="plus" className="text-[16px]" />
            New announcement
          </button>
        </div>
      )}

      {tab === 'whatsapp' && (
        <Card>
          <Empty
            icon="brand-whatsapp"
            message="WhatsApp integration isn't built yet — there's no WhatsApp Business API connection or opt-in tracking in this version. This is a real, separate feature to build, not a configuration to toggle on."
          />
        </Card>
      )}

      {compose && (
        <Modal title="New message" onClose={() => setCompose(false)}>
          <ComposeForm
            schoolId={schoolId}
            currentUserId={currentUserId}
            users={messageableUsers}
            onSent={() => setCompose(false)}
            onCancel={() => setCompose(false)}
          />
        </Modal>
      )}
      {announce && (
        <Modal title="New announcement" onClose={() => setAnnounce(false)}>
          <AnnouncementForm
            schoolId={schoolId}
            currentUserId={currentUserId}
            classes={[]}
            onSent={() => setAnnounce(false)}
            onCancel={() => setAnnounce(false)}
          />
        </Modal>
      )}
    </div>
  );
}
