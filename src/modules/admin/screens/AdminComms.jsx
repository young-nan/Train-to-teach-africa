/**
 * AdminComms.jsx — Full communications module
 * Inbox · Compose · Announcements · WhatsApp opt-ins
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
      <div className="relative w-full max-w-[520px] bg-[var(--c-surface-2)] border border-[var(--c-line-2)] rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--c-line-1)]">
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

// ── Mock data (replace with real Supabase queries as message table is built) ──
const MOCK_MESSAGES = [
  { id:'1', from:'Mrs Janet Adeyemi', role:'teacher',  avatar:'JA', subject:'Chidi Obi — behaviour concern', body:'I wanted to flag that Chidi has been distracted in class this week. Recommend a parent meeting.', time:'10:24 AM', date:'Today',     unread:true,  type:'teacher_to_admin' },
  { id:'2', from:'Mr Tunde Okonkwo', role:'teacher',  avatar:'TO', subject:'Attendance query — Primary 2B',  body:'Several parents have not confirmed this week\'s field trip permission slips.',               time:'8:51 AM',  date:'Today',     unread:true,  type:'teacher_to_admin' },
  { id:'3', from:'Mrs Ngozi Bello',  role:'parent',   avatar:'NB', subject:'Re: Term 3 report card',         body:'Thank you for sharing the report. We\'re very pleased with Amara\'s progress.',              time:'Yesterday', date:'Yesterday', unread:false, type:'parent_to_admin'  },
  { id:'4', from:'Mr Ade Johnson',   role:'parent',   avatar:'AJ', subject:'Absence notification',           body:'Kemi will be absent on Friday 20th June for a medical appointment.',                       time:'Mon',       date:'Monday',    unread:false, type:'parent_to_admin'  },
];

const MOCK_ANNOUNCEMENTS = [
  { id:'1', title:'End of Term Assembly', body:'The end of term assembly will hold on Friday 27 June at 9:00 AM. All parents are welcome.', audience:'all',     sent:'2 days ago', views:142 },
  { id:'2', title:'Term 3 Report Cards', body:'Report cards for Term 3 are now available. Parents can download them from their dashboard.',   audience:'parents', sent:'1 week ago',  views:98  },
  { id:'3', title:'Staff Meeting',        body:'Mandatory staff meeting this Thursday at 3:30 PM in the conference room.',                     audience:'staff',   sent:'1 week ago',  views:14  },
];

const TABS = [
  { key: 'inbox',         label: 'Inbox',         count: 2   },
  { key: 'announcements', label: 'Announcements'              },
  { key: 'whatsapp',      label: 'WhatsApp'                   },
];

const AUDIENCE_META = {
  all:     { label: 'Everyone',   variant: 'violet' },
  parents: { label: 'Parents',    variant: 'rose'   },
  staff:   { label: 'Staff',      variant: 'teal'   },
  class:   { label: 'Class',      variant: 'gold'   },
};

// ── Compose form ──────────────────────────────────────────────────────────────
function ComposeForm({ onSend, onCancel }) {
  const [form, setForm] = useState({ to:'', subject:'', body:'' });
  const [sending, setSending] = useState(false);

  const update = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSend = async (e) => {
    e.preventDefault();
    setSending(true);
    await new Promise(r => setTimeout(r, 800)); // Replace with real send
    setSending(false);
    onSend();
  };

  return (
    <form onSubmit={handleSend} className="space-y-4">
      <FormGroup label="To">
        <Select value={form.to} onChange={update('to')} required>
          <option value="">Select recipient…</option>
          <option value="all_parents">All parents</option>
          <option value="all_teachers">All teachers</option>
          <option value="class_p2a">Primary 2A parents</option>
          <option value="class_p2b">Primary 2B parents</option>
          <option value="class_p3a">Primary 3A parents</option>
        </Select>
      </FormGroup>
      <FormGroup label="Subject *">
        <Input placeholder="Message subject…" value={form.subject} onChange={update('subject')} required />
      </FormGroup>
      <FormGroup label="Message *">
        <Textarea rows={5} placeholder="Type your message here…" value={form.body} onChange={update('body')} required className="resize-none" />
      </FormGroup>
      <div className="flex gap-3 pt-1">
        <Button variant="primary" type="submit" isLoading={sending} icon="send" className="flex-1 justify-center">
          Send message
        </Button>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

// ── Announcement form ─────────────────────────────────────────────────────────
function AnnouncementForm({ onSend, onCancel }) {
  const [form, setForm] = useState({ title:'', body:'', audience:'all' });
  const [sending, setSending] = useState(false);

  const update = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSend = async (e) => {
    e.preventDefault();
    setSending(true);
    await new Promise(r => setTimeout(r, 800));
    setSending(false);
    onSend();
  };

  return (
    <form onSubmit={handleSend} className="space-y-4">
      <FormGroup label="Announcement title *">
        <Input placeholder="e.g. End of Term Assembly" value={form.title} onChange={update('title')} required />
      </FormGroup>
      <FormGroup label="Audience *">
        <Select value={form.audience} onChange={update('audience')}>
          <option value="all">Everyone (staff + parents + students)</option>
          <option value="parents">Parents only</option>
          <option value="staff">Staff only</option>
          <option value="class">Specific class</option>
        </Select>
      </FormGroup>
      <FormGroup label="Message *">
        <Textarea rows={4} placeholder="Announcement body…" value={form.body} onChange={update('body')} required className="resize-none" />
      </FormGroup>
      <Alert type="info">
        This announcement will be sent via the app, email, and WhatsApp (for opted-in users).
      </Alert>
      <div className="flex gap-3 pt-1">
        <Button variant="primary" type="submit" isLoading={sending} icon="speakerphone" className="flex-1 justify-center">
          Publish announcement
        </Button>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

// ── Message thread view ───────────────────────────────────────────────────────
function ThreadView({ message, onBack, onReply }) {
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const handleReply = async (e) => {
    e.preventDefault();
    setSending(true);
    await new Promise(r => setTimeout(r, 600));
    setSending(false);
    setReply('');
    onReply();
  };

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 text-[13px] text-[var(--product-accent)] mb-4 hover:opacity-80">
        <Icon name="arrow-left" className="text-[16px]" /> Back to inbox
      </button>
      <Card className="mb-4">
        <div className="flex items-start gap-3 mb-4">
          <Avatar name={message.from} size="lg" />
          <div className="flex-1">
            <div className="font-semibold text-[var(--c-ink-0)]">{message.from}</div>
            <div className="text-[11px] text-[var(--c-ink-3)] mt-0.5">{message.date} · {message.time}</div>
          </div>
          <Chip variant={message.role === 'teacher' ? 'teal' : 'rose'} size="sm">
            {message.role === 'teacher' ? 'Teacher' : 'Parent'}
          </Chip>
        </div>
        <h3 className="font-semibold text-[15px] text-[var(--c-ink-0)] mb-3">{message.subject}</h3>
        <p className="text-[13px] text-[var(--c-ink-2)] leading-relaxed">{message.body}</p>
      </Card>

      {/* Reply */}
      <Card>
        <CardHeader title="Reply" />
        <form onSubmit={handleReply} className="space-y-3">
          <Textarea
            rows={3}
            placeholder="Type your reply…"
            value={reply}
            onChange={e => setReply(e.target.value)}
            required
            className="resize-none"
          />
          <div className="flex gap-2">
            <Button variant="primary" type="submit" isLoading={sending} icon="send">Send reply</Button>
            <Button variant="ghost" icon="brand-whatsapp">Reply via WhatsApp</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AdminComms() {
  const { profile } = useAuth();
  const [tab, setTab]             = useState('inbox');
  const [compose, setCompose]     = useState(false);
  const [announce, setAnnounce]   = useState(false);
  const [thread, setThread]       = useState(null);
  const [search, setSearch]       = useState('');

  const filtered = MOCK_MESSAGES.filter(m =>
    !search ||
    m.from.toLowerCase().includes(search.toLowerCase()) ||
    m.subject.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Communications"
        subtitle="Messages, announcements, and WhatsApp integration."
      >
        <Button variant="primary" icon="plus" onClick={() => setCompose(true)}>New message</Button>
        <Button variant="ghost" icon="speakerphone" onClick={() => setAnnounce(true)}>Announcement</Button>
      </PageHeader>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Unread messages"   value={MOCK_MESSAGES.filter(m=>m.unread).length} deltaDir="flat" icon="message-dots"    />
        <KpiCard label="Sent today"        value="12"  deltaDir="up" delta="+3 vs yesterday"  icon="send"           />
        <KpiCard label="Parent responses"  value="7"   deltaDir="up" delta="This week"         icon="messages"       />
        <KpiCard label="WhatsApp opt-ins"  value="94"  deltaDir="up" delta="79% of parents"    icon="brand-whatsapp" />
      </div>

      <Tabs tabs={TABS} active={tab} onChange={t => { setTab(t); setThread(null); }} />

      {/* ── Inbox ── */}
      {tab === 'inbox' && (
        thread ? (
          <ThreadView message={thread} onBack={() => setThread(null)} onReply={() => setThread(null)} />
        ) : (
          <>
            <div className="mb-4">
              <Input className="max-w-[280px]" placeholder="Search messages…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Card padding={false}>
              {filtered.length === 0 ? (
                <Empty icon="inbox" message="No messages found." />
              ) : (
                filtered.map(msg => (
                  <div
                    key={msg.id}
                    onClick={() => setThread(msg)}
                    className="flex items-start gap-4 px-5 py-4 border-b border-[var(--c-line-1)] last:border-0 hover:bg-[var(--c-surface-3)] transition-colors cursor-pointer"
                  >
                    {/* Unread dot */}
                    <div className="mt-1.5 w-2 h-2 rounded-full shrink-0 transition-all"
                      style={{ background: msg.unread ? 'var(--product-accent)' : 'transparent' }} />

                    <Avatar name={msg.from} size="sm" />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className={`text-[13px] ${msg.unread ? 'font-bold text-[var(--c-ink-0)]' : 'font-medium text-[var(--c-ink-1)]'}`}>
                          {msg.from}
                        </span>
                        <span className="text-[11px] text-[var(--c-ink-4)] font-mono shrink-0">{msg.time}</span>
                      </div>
                      <div className={`text-[13px] truncate ${msg.unread ? 'text-[var(--c-ink-1)]' : 'text-[var(--c-ink-2)]'}`}>
                        {msg.subject}
                      </div>
                      <div className="text-[11px] text-[var(--c-ink-4)] truncate mt-0.5">{msg.body}</div>
                    </div>

                    <Chip variant={msg.role === 'teacher' ? 'teal' : 'rose'} size="sm">
                      {msg.role === 'teacher' ? 'Teacher' : 'Parent'}
                    </Chip>
                  </div>
                ))
              )}
            </Card>
          </>
        )
      )}

      {/* ── Announcements ── */}
      {tab === 'announcements' && (
        <div className="space-y-4">
          {MOCK_ANNOUNCEMENTS.map(ann => {
            const meta = AUDIENCE_META[ann.audience] ?? AUDIENCE_META.all;
            return (
              <Card key={ann.id}>
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1">
                    <div className="font-heading font-semibold text-[15px] text-[var(--c-ink-0)]">{ann.title}</div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Chip variant={meta.variant} size="sm">{meta.label}</Chip>
                      <span className="text-[11px] text-[var(--c-ink-4)]">{ann.sent}</span>
                      <span className="text-[11px] text-[var(--c-ink-4)]">· {ann.views} views</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" icon="dots-vertical" />
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

      {/* ── WhatsApp ── */}
      {tab === 'whatsapp' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader title="WhatsApp integration status" />
            <div className="flex items-center gap-3 p-4 rounded-xl mb-4"
              style={{ background:'rgba(37,211,102,0.08)', border:'1px solid rgba(37,211,102,0.2)' }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{ background:'rgba(37,211,102,0.15)' }}>
                <Icon name="brand-whatsapp" className="text-[20px]" style={{ color:'#25d366' }} />
              </div>
              <div>
                <div className="font-semibold text-[var(--c-ink-0)] text-[14px]">Connected</div>
                <div className="text-[11px] text-[var(--c-ink-3)] mt-0.5">94 parents opted in · 79% coverage</div>
              </div>
              <Chip variant="green" className="ml-auto">Active</Chip>
            </div>
            <div className="space-y-1">
              {[
                { label:'Messages sent today',     value:'24' },
                { label:'Delivery rate',           value:'98.2%' },
                { label:'Parent opt-in rate',      value:'79%' },
                { label:'Attendance alerts sent',  value:'8 this week' },
              ].map(r => (
                <div key={r.label} className="flex items-center justify-between py-2.5 border-b border-[var(--c-line-1)] last:border-0 text-[13px]">
                  <span className="text-[var(--c-ink-3)]">{r.label}</span>
                  <span className="font-semibold text-[var(--c-ink-0)]">{r.value}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Send WhatsApp broadcast" />
            <FormGroup label="Message template">
              <Select>
                <option>Attendance alert</option>
                <option>Fee reminder</option>
                <option>Event notification</option>
                <option>Report card ready</option>
                <option>Custom message</option>
              </Select>
            </FormGroup>
            <FormGroup label="Audience">
              <Select>
                <option>All opted-in parents (94)</option>
                <option>Primary 2A parents</option>
                <option>Primary 2B parents</option>
                <option>Primary 3A parents</option>
              </Select>
            </FormGroup>
            <FormGroup label="Preview">
              <div className="p-3 bg-[var(--c-surface-3)] rounded-lg text-[12px] text-[var(--c-ink-2)] leading-relaxed font-mono">
                🏫 TLF Lekki Academy<br/>
                Your child was marked <strong>absent</strong> today (13 Jun).<br/>
                Please contact the school if this is an error.<br/>
                📞 0800-TLF-LEKKI
              </div>
            </FormGroup>
            <Button variant="primary" icon="brand-whatsapp" className="w-full justify-center">
              Send broadcast
            </Button>
          </Card>
        </div>
      )}

      {/* Modals */}
      {compose && (
        <Modal title="New message" onClose={() => setCompose(false)}>
          <ComposeForm onSend={() => setCompose(false)} onCancel={() => setCompose(false)} />
        </Modal>
      )}
      {announce && (
        <Modal title="New announcement" onClose={() => setAnnounce(false)}>
          <AnnouncementForm onSend={() => setAnnounce(false)} onCancel={() => setAnnounce(false)} />
        </Modal>
      )}
    </div>
  );
}
