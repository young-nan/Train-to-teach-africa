/**
 * TutorApp screens — full tutor marketplace experience
 * Dashboard · Requests · Sessions · My Students · Earnings · Reviews · Profile
 */

import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { ProductTheme } from '@/components/layout/ProductThemeProvider';
import { Icon } from '@/components/ui/Icon';
import {
  PageHeader, Card, CardHeader, KpiCard, Chip, Button,
  Avatar, Input, Select, FormGroup, Textarea, Alert,
  ProgressBar, Tabs, LoadingScreen, Empty, StatRow, Divider,
} from '@/components/ui';

// ── Nav ───────────────────────────────────────────────────────────────────────
const NAV = [
  { to:'/tutor',          end:true, icon:'layout-dashboard', label:'Dashboard'   },
  { to:'/tutor/requests', icon:'inbox',          label:'Requests',   badge:3     },
  { to:'/tutor/sessions', icon:'calendar-check', label:'Sessions'                },
  { to:'/tutor/students', icon:'users',          label:'My students'             },
  { to:'/tutor/earnings', icon:'wallet',         label:'Earnings'                },
  { to:'/tutor/reviews',  icon:'star',           label:'Reviews'                 },
  { to:'/tutor/profile',  icon:'user-circle',    label:'My profile'              },
];

// ── Mock data ─────────────────────────────────────────────────────────────────
const MOCK_REQUESTS = [
  { id:'1', parent:'Mrs Okonkwo',  subject:'Mathematics',   level:'Primary 4', loc:'Victoria Island', mode:'In-person', budget:'₦5,000/hr',  days:'Mon/Wed/Fri', urgent:true  },
  { id:'2', parent:'Mr Suleiman',  subject:'English',        level:'JSS 1',     loc:'Lekki Phase 1',  mode:'Online',    budget:'₦4,500/hr',  days:'Tue/Thu',     urgent:false },
  { id:'3', parent:'Dr Adeleke',   subject:'Basic Science',  level:'Primary 6', loc:'Ikeja',          mode:'In-person', budget:'₦6,000/hr',  days:'Sat/Sun',     urgent:false },
  { id:'4', parent:'Mrs Eze',      subject:'Mathematics',   level:'Primary 5', loc:'Yaba',            mode:'Online',    budget:'₦4,000/hr',  days:'Mon/Fri',     urgent:true  },
];

const MOCK_SESSIONS = [
  { id:'1', student:'Amara Okonkwo', subject:'Mathematics',   date:'Sat 14 Jun', time:'10:00 AM', mode:'Online',    status:'upcoming' },
  { id:'2', student:'Bola Adeyemi',  subject:'English',        date:'Sat 14 Jun', time:'2:00 PM',  mode:'In-person', status:'upcoming' },
  { id:'3', student:'Chioma Nwosu',  subject:'Basic Science',  date:'Sun 15 Jun', time:'9:00 AM',  mode:'Online',    status:'upcoming' },
  { id:'4', student:'Emeka Obi',     subject:'Mathematics',   date:'Mon 10 Jun', time:'4:00 PM',  mode:'Online',    status:'completed'},
  { id:'5', student:'Fatima Bello',  subject:'English',        date:'Wed 12 Jun', time:'5:00 PM',  mode:'In-person', status:'completed'},
];

const MOCK_STUDENTS = [
  { id:'1', name:'Amara Okonkwo', level:'Primary 4', subject:'Mathematics',  sessions:8,  nextSession:'Sat 14 Jun',  progress:72 },
  { id:'2', name:'Bola Adeyemi',  level:'JSS 1',     subject:'English',      sessions:6,  nextSession:'Sat 14 Jun',  progress:65 },
  { id:'3', name:'Chioma Nwosu',  level:'Primary 6', subject:'Basic Science',sessions:12, nextSession:'Sun 15 Jun',  progress:84 },
  { id:'4', name:'Emeka Obi',     level:'Primary 5', subject:'Mathematics',  sessions:4,  nextSession:'Tue 17 Jun',  progress:58 },
];

const MOCK_REVIEWS = [
  { name:'Mrs Okonkwo',  rating:5, text:'Excellent tutor! My daughter\'s maths improved dramatically in just 4 sessions.',  date:'2 weeks ago' },
  { name:'Mr Suleiman',  rating:5, text:'Very patient and thorough. Highly recommended for any parent.',                    date:'1 month ago'  },
  { name:'Dr Adeleke',   rating:4, text:'Good teacher, always well-prepared. Would have liked slightly more homework.',     date:'1 month ago'  },
  { name:'Mrs Johnson',  rating:5, text:'Our son went from failing to passing in one term. Outstanding results.',           date:'2 months ago' },
];

// ── Dashboard ─────────────────────────────────────────────────────────────────
function TutorDashboard() {
  return (
    <div>
      <PageHeader eyebrow="Tutor · Lagos" title="Your dashboard" subtitle="3 new session requests this week." />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Active students"   value="12"     deltaDir="up"   delta="+2 this month"    icon="users"     />
        <KpiCard label="Pending requests"  value="4"      deltaDir="flat" delta="Reply within 24h"  icon="inbox"     />
        <KpiCard label="Your rating"       value="4.9 ★"  deltaDir="up"   delta="From 28 reviews"   icon="star"      />
        <KpiCard label="This month"        value="₦145K"  deltaDir="up"   delta="+22% vs last"      icon="wallet"    />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* New requests */}
        <Card>
          <CardHeader title="New requests" action="See all 4" />
          <div className="space-y-3">
            {MOCK_REQUESTS.slice(0,3).map(r=>(
              <div key={r.id} className="flex items-start gap-3 p-3 bg-[var(--c-surface-3)] rounded-xl">
                <Avatar name={r.parent} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-[var(--c-ink-0)] text-[13px]">{r.parent}</span>
                    {r.urgent && <Chip variant="red" size="sm">Urgent</Chip>}
                  </div>
                  <div className="text-[11px] text-[var(--c-ink-3)] mt-0.5">{r.subject} · {r.level} · {r.loc}</div>
                  <div className="text-[11px] font-semibold mt-1" style={{color:'var(--c-emerald-400)'}}>{r.budget} · {r.days}</div>
                </div>
                <Button variant="ghost" size="sm">View</Button>
              </div>
            ))}
          </div>
        </Card>

        {/* Upcoming sessions */}
        <Card>
          <CardHeader title="Upcoming sessions" />
          {MOCK_SESSIONS.filter(s=>s.status==='upcoming').map(s=>(
            <div key={s.id} className="flex items-center gap-3 py-3 border-b border-[var(--c-line-1)] last:border-0">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{background:s.mode==='Online'?'rgba(34,184,166,0.15)':'rgba(229,166,42,0.15)',
                        color:s.mode==='Online'?'var(--c-teal-400)':'var(--product-accent)'}}>
                <Icon name={s.mode==='Online'?'video':'map-pin'} className="text-[16px]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-[var(--c-ink-0)]">{s.student}</div>
                <div className="text-[11px] text-[var(--c-ink-3)] mt-0.5">{s.subject} · {s.date} · {s.time}</div>
              </div>
              <Chip variant={s.mode==='Online'?'teal':'gold'} size="sm">{s.mode}</Chip>
            </div>
          ))}
          <Button variant="ghost" size="sm" icon="calendar" className="mt-3 w-full justify-center">View full schedule</Button>
        </Card>
      </div>
    </div>
  );
}

// ── Requests ──────────────────────────────────────────────────────────────────
function TutorRequests() {
  const [activeReq, setActiveReq] = useState(null);
  const [tab, setTab] = useState('new');

  return (
    <div>
      <PageHeader eyebrow="Tutor" title="Session requests" subtitle="Parents looking for a tutor like you.">
        <Chip variant="rose">{MOCK_REQUESTS.length} new</Chip>
      </PageHeader>
      <Tabs tabs={[{key:'new',label:'New',count:MOCK_REQUESTS.length},{key:'accepted',label:'Accepted'},{key:'declined',label:'Declined'}]} active={tab} onChange={setTab} />

      {tab==='new' && (
        <div className="space-y-4">
          {MOCK_REQUESTS.map(r=>(
            <Card key={r.id}>
              <div className="flex items-start gap-4">
                <Avatar name={r.parent} size="lg" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-heading font-bold text-[15px] text-[var(--c-ink-0)]">{r.parent}</span>
                    {r.urgent && <Chip variant="red" size="sm">Urgent</Chip>}
                    <Chip variant={r.mode==='Online'?'teal':'gold'} size="sm">{r.mode}</Chip>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                    {[
                      {label:'Subject',  value:r.subject},
                      {label:'Level',    value:r.level},
                      {label:'Location', value:r.loc},
                      {label:'Schedule', value:r.days},
                    ].map(({label,value})=>(
                      <div key={label}>
                        <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-[var(--c-ink-4)]">{label}</div>
                        <div className="text-[13px] font-medium text-[var(--c-ink-1)] mt-0.5">{value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-[14px] font-bold" style={{color:'var(--c-emerald-400)'}}>{r.budget}</span>
                    <span className="text-[11px] text-[var(--c-ink-3)]">proposed rate</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-4 pt-4 border-t border-[var(--c-line-1)]">
                <Button variant="primary" icon="check" className="flex-1 justify-center">Accept request</Button>
                <Button variant="ghost" icon="message-dots">Message parent</Button>
                <Button variant="ghost" icon="x">Decline</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      {tab==='accepted' && <Card><Empty icon="calendar-check" message="Accepted requests will appear here." /></Card>}
      {tab==='declined' && <Card><Empty icon="x"             message="Declined requests will appear here." /></Card>}
    </div>
  );
}

// ── Sessions ──────────────────────────────────────────────────────────────────
function TutorSessions() {
  const [tab, setTab] = useState('upcoming');
  const sessions = MOCK_SESSIONS.filter(s=>tab==='upcoming'?s.status==='upcoming':s.status==='completed');

  return (
    <div>
      <PageHeader eyebrow="Tutor" title="Sessions" subtitle="Your tutoring schedule and history.">
        <Button variant="primary" icon="plus">Add availability</Button>
      </PageHeader>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard label="This week"   value="3"    deltaDir="flat" icon="calendar-week"  />
        <KpiCard label="This month"  value="12"   deltaDir="up"   delta="+2 vs last"    icon="calendar"      />
        <KpiCard label="Online"      value="8"    deltaDir="flat" icon="video"          />
        <KpiCard label="In-person"   value="4"    deltaDir="flat" icon="map-pin"        />
      </div>
      <Tabs tabs={[{key:'upcoming',label:'Upcoming',count:MOCK_SESSIONS.filter(s=>s.status==='upcoming').length},{key:'completed',label:'Completed'}]} active={tab} onChange={setTab} />
      <Card padding={false}>
        {sessions.length===0 ? <div className="p-8"><Empty icon="calendar" message={`No ${tab} sessions.`} /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--c-line-2)]">
                  {['Student','Subject','Date','Time','Mode',''].map(h=>(
                    <th key={h} className="text-left px-5 py-3 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--c-ink-3)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sessions.map(s=>(
                  <tr key={s.id} className="border-b border-[var(--c-line-1)] last:border-0 hover:bg-[var(--c-surface-3)] transition-colors">
                    <td className="px-5 py-3 font-semibold text-[var(--c-ink-0)]">{s.student}</td>
                    <td className="px-5 py-3 text-[var(--c-ink-2)]">{s.subject}</td>
                    <td className="px-5 py-3 text-[var(--c-ink-2)]">{s.date}</td>
                    <td className="px-5 py-3 font-mono text-[11px] text-[var(--c-ink-3)]">{s.time}</td>
                    <td className="px-5 py-3"><Chip variant={s.mode==='Online'?'teal':'gold'} size="sm">{s.mode}</Chip></td>
                    <td className="px-5 py-3">
                      {s.status==='upcoming' && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" icon={s.mode==='Online'?'video':'map-pin'}>Join</Button>
                          <Button variant="ghost" size="sm" icon="dots-vertical" />
                        </div>
                      )}
                      {s.status==='completed' && <Chip variant="green" size="sm">Done</Chip>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ── My Students ───────────────────────────────────────────────────────────────
function TutorStudents() {
  return (
    <div>
      <PageHeader eyebrow="Tutor" title="My students" subtitle={`${MOCK_STUDENTS.length} active students`} />
      <div className="grid sm:grid-cols-2 gap-4">
        {MOCK_STUDENTS.map(s=>(
          <Card key={s.id}>
            <div className="flex items-start gap-3 mb-4">
              <Avatar name={s.name} size="lg" />
              <div className="flex-1">
                <div className="font-heading font-semibold text-[15px] text-[var(--c-ink-0)]">{s.name}</div>
                <div className="text-[11px] text-[var(--c-ink-3)] mt-0.5">{s.level} · {s.subject}</div>
                <div className="flex items-center gap-2 mt-1.5">
                  <Chip variant="default" size="sm">{s.sessions} sessions</Chip>
                </div>
              </div>
            </div>
            <div className="mb-1 flex items-center justify-between text-[11px]">
              <span className="text-[var(--c-ink-3)]">Progress</span>
              <span className="font-semibold text-[var(--c-ink-0)]">{s.progress}%</span>
            </div>
            <ProgressBar value={s.progress} color={s.progress>=75?'var(--c-green-400)':s.progress>=50?'var(--product-accent)':'var(--c-red-400)'} />
            <div className="mt-3 text-[11px] text-[var(--c-ink-3)]">
              Next session: <span className="text-[var(--c-ink-1)] font-medium">{s.nextSession}</span>
            </div>
            <div className="flex gap-2 mt-3">
              <Button variant="ghost" size="sm" icon="message-dots">Message parent</Button>
              <Button variant="ghost" size="sm" icon="file-text">Session notes</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Earnings ──────────────────────────────────────────────────────────────────
function TutorEarnings() {
  const monthly = [
    { month:'Jan', amount:98000  },
    { month:'Feb', amount:112000 },
    { month:'Mar', amount:125000 },
    { month:'Apr', amount:108000 },
    { month:'May', amount:138000 },
    { month:'Jun', amount:145000 },
  ];
  const max = Math.max(...monthly.map(m=>m.amount));

  return (
    <div>
      <PageHeader eyebrow="Tutor" title="Earnings" subtitle="Your income summary and payout history.">
        <Button variant="ghost" icon="download">Download statement</Button>
      </PageHeader>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard label="This month"   value="₦145,000" deltaDir="up" delta="+22% vs last"    icon="trending-up"  />
        <KpiCard label="Last month"   value="₦138,000" deltaDir="up" delta=""                 icon="calendar"     />
        <KpiCard label="This year"    value="₦726,000" deltaDir="up" delta="YTD"              icon="wallet"       />
        <KpiCard label="Pending"      value="₦45,000"  deltaDir="flat" delta="Next payout Fri" icon="clock"       />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Monthly earnings (₦)" />
          <div className="flex items-end gap-2 h-32 mt-2">
            {monthly.map(m=>(
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full rounded-t transition-all"
                  style={{ height:`${Math.round((m.amount/max)*100)}%`, background:'var(--product-accent)', opacity:0.75, minHeight:'4px' }} />
                <div className="text-[10px] text-[var(--c-ink-4)]">{m.month}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title="Payout history" />
          {[
            { date:'01 Jun 2025', amount:'₦138,000', status:'paid'    },
            { date:'01 May 2025', amount:'₦125,000', status:'paid'    },
            { date:'01 Apr 2025', amount:'₦108,000', status:'paid'    },
            { date:'01 Mar 2025', amount:'₦112,000', status:'paid'    },
          ].map((p,i)=>(
            <div key={i} className="flex items-center justify-between py-2.5 border-b border-[var(--c-line-1)] last:border-0">
              <span className="text-[12px] font-mono text-[var(--c-ink-3)]">{p.date}</span>
              <span className="text-[13px] font-bold text-[var(--c-ink-0)]">{p.amount}</span>
              <Chip variant="green" size="sm">{p.status}</Chip>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

// ── Reviews ───────────────────────────────────────────────────────────────────
function TutorReviews() {
  return (
    <div>
      <PageHeader eyebrow="Tutor" title="Reviews" subtitle={`4.9 average · ${MOCK_REVIEWS.length} reviews`} />
      <div className="flex items-center gap-6 p-5 bg-[var(--c-surface-2)] border border-[var(--c-line-2)] rounded-xl mb-5">
        <div className="text-center">
          <div className="font-heading text-[48px] font-bold text-[var(--c-ink-0)]">4.9</div>
          <div className="text-[20px] text-[var(--c-amber-400)]">★★★★★</div>
          <div className="text-[11px] text-[var(--c-ink-3)] mt-1">{MOCK_REVIEWS.length} reviews</div>
        </div>
        <div className="flex-1">
          {[5,4,3,2,1].map(star=>{
            const count = MOCK_REVIEWS.filter(r=>r.rating===star).length;
            const pct   = Math.round((count/MOCK_REVIEWS.length)*100);
            return (
              <div key={star} className="flex items-center gap-2 mb-1">
                <span className="text-[11px] text-[var(--c-ink-3)] w-4">{star}</span>
                <span className="text-[10px] text-[var(--c-amber-400)]">★</span>
                <div className="flex-1 bg-[var(--c-surface-4)] rounded-full h-1.5">
                  <div className="h-full rounded-full" style={{width:`${pct}%`,background:'var(--c-amber-400)'}} />
                </div>
                <span className="text-[11px] text-[var(--c-ink-4)] w-4 text-right">{count}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="space-y-4">
        {MOCK_REVIEWS.map((r,i)=>(
          <Card key={i}>
            <div className="flex items-start gap-3 mb-3">
              <Avatar name={r.name} />
              <div className="flex-1">
                <div className="font-semibold text-[var(--c-ink-0)]">{r.name}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[13px] text-[var(--c-amber-400)]">{'★'.repeat(r.rating)}</span>
                  <span className="text-[10px] font-mono text-[var(--c-ink-4)]">{r.date}</span>
                </div>
              </div>
            </div>
            <p className="text-[13px] text-[var(--c-ink-2)] leading-relaxed italic">"{r.text}"</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Profile ───────────────────────────────────────────────────────────────────
function TutorProfile() {
  const [form, setForm] = useState({
    bio:'Experienced primary school educator with 8+ years teaching Mathematics and Basic Science. I specialise in helping children build strong foundations through engaging, child-centred methods.',
    subjects:'Mathematics, Basic Science, English Language',
    levels:'Primary 1–6, JSS 1–3',
    location:'Lagos (Victoria Island, Lekki, Ikoyi)',
    rate:'₦5,000',
    online:true,
    inperson:true,
  });

  return (
    <div>
      <PageHeader eyebrow="Tutor" title="My profile" subtitle="How parents see you on the TTA marketplace." />
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Preview card */}
        <Card className="lg:col-span-1">
          <div className="text-center mb-4">
            <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center font-bold text-[22px] mb-3"
              style={{background:'rgba(16,185,129,0.2)',color:'var(--c-emerald-400)'}}>WS</div>
            <div className="font-heading font-bold text-[16px] text-[var(--c-ink-0)]">Wisdom Sunday</div>
            <div className="text-[12px] text-[var(--c-ink-3)] mt-0.5">Lagos · Verified ✓</div>
            <div className="text-[18px] text-[var(--c-amber-400)] mt-1">★★★★★ <span className="text-[12px] text-[var(--c-ink-3)]">4.9</span></div>
          </div>
          <Divider />
          <StatRow label="Sessions delivered" value="47"              />
          <StatRow label="Students taught"    value="12"              />
          <StatRow label="Response time"      value="< 2 hours"       />
          <StatRow label="Rate"               value="₦5,000/hr"       />
          <div className="mt-4 flex gap-2 flex-wrap">
            <Chip variant="default" size="sm">Mathematics</Chip>
            <Chip variant="default" size="sm">Basic Science</Chip>
            <Chip variant="default" size="sm">English</Chip>
          </div>
        </Card>

        {/* Edit form */}
        <Card className="lg:col-span-2">
          <CardHeader title="Edit profile" />
          <div className="space-y-4">
            <FormGroup label="Bio">
              <Textarea rows={4} value={form.bio} onChange={e=>setForm(p=>({...p,bio:e.target.value}))} />
            </FormGroup>
            <FormGroup label="Subjects">
              <Input value={form.subjects} onChange={e=>setForm(p=>({...p,subjects:e.target.value}))} />
            </FormGroup>
            <FormGroup label="Levels taught">
              <Input value={form.levels} onChange={e=>setForm(p=>({...p,levels:e.target.value}))} />
            </FormGroup>
            <div className="grid grid-cols-2 gap-3">
              <FormGroup label="Location">
                <Input value={form.location} onChange={e=>setForm(p=>({...p,location:e.target.value}))} />
              </FormGroup>
              <FormGroup label="Hourly rate (₦)">
                <Input value={form.rate} onChange={e=>setForm(p=>({...p,rate:e.target.value}))} />
              </FormGroup>
            </div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer text-[13px] text-[var(--c-ink-1)]">
                <input type="checkbox" checked={form.online} onChange={e=>setForm(p=>({...p,online:e.target.checked}))} className="w-4 h-4 accent-[var(--product-accent)]"/>
                Available online
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-[13px] text-[var(--c-ink-1)]">
                <input type="checkbox" checked={form.inperson} onChange={e=>setForm(p=>({...p,inperson:e.target.checked}))} className="w-4 h-4 accent-[var(--product-accent)]"/>
                Available in-person
              </label>
            </div>
            <Button variant="primary" icon="device-floppy">Save profile</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── TutorApp root ─────────────────────────────────────────────────────────────
export function TutorApp() {
  return (
    <ProductTheme surface="tutor">
      <AppShell navItems={NAV} title="Tutor">
        <Routes>
          <Route index           element={<TutorDashboard />} />
          <Route path="requests" element={<TutorRequests />}  />
          <Route path="sessions" element={<TutorSessions />}  />
          <Route path="students" element={<TutorStudents />}  />
          <Route path="earnings" element={<TutorEarnings />}  />
          <Route path="reviews"  element={<TutorReviews />}   />
          <Route path="profile"  element={<TutorProfile />}   />
          <Route path="*"        element={<Navigate to="/tutor" replace />} />
        </Routes>
      </AppShell>
    </ProductTheme>
  );
}
