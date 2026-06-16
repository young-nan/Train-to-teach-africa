/**
 * StudentApp.jsx
 */
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { ProductTheme } from '@/components/layout/ProductThemeProvider';
import { PageHeader, Card, CardHeader, KpiCard, Chip, Button, ProgressBar, Empty, LoadingScreen, Tabs } from '@/components/ui';
import LessonViewer from '@/components/lesson/LessonViewer';
import { useState } from 'react';

// ── Student Today ─────────────────────────────────────────────────────────────
const LESSONS_TODAY = [
  { sub:'Mathematics',     topic:'Multiplication Tables',      done:true,    color:'#e5a62a' },
  { sub:'English Language',topic:'Reading — My Family',        done:true,    color:'#3b82f6' },
  { sub:'Basic Science',   topic:'Plants and Their Parts',     active:true,  color:'#3fb950' },
  { sub:'Social Studies',  topic:'Community Helpers',          done:false,   color:'#22b8a6' },
  { sub:'CRS',             topic:'The Good Samaritan',         done:false,   color:'#f97066' },
];

function StudentToday() {
  return (
    <div>
      <PageHeader eyebrow="Student · Primary 2A" title="Ready to learn, Chidi? 🌟" subtitle="Friday · 2 lessons left today" />
      {/* Resume card */}
      <div className="p-5 rounded-2xl mb-5 cursor-pointer"
        style={{ background:'linear-gradient(135deg,rgba(249,112,102,0.12),rgba(229,166,42,0.06))', border:'1px solid rgba(249,112,102,0.2)' }}>
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--c-coral-400)] mb-2">Continue where you left off</div>
        <div className="font-heading text-[20px] font-bold text-[var(--c-ink-0)]">Plants and Their Parts</div>
        <div className="text-[12px] text-[var(--c-ink-3)] mt-1">Basic Science · Page 3 of 6 · Quiz unlocked</div>
        <ProgressBar value={50} color="var(--c-coral-400)" className="mt-3" />
        <div className="flex items-center gap-3 mt-4">
          <Button variant="primary" icon="player-play" style={{ background:'var(--c-coral-400)', color:'#fff' }}>Continue</Button>
          <span className="text-[12px] text-[var(--c-ink-3)]">~12 mins left</span>
        </div>
      </div>
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <KpiCard label="🔥 Streak" value="12 days" deltaDir="flat" />
        <KpiCard label="Badges"     value="8"       deltaDir="up" delta="+1 today" />
        <KpiCard label="Today"      value="4 / 5"   deltaDir="up" delta="1 left"   />
      </div>
      {/* Lessons */}
      <Card>
        <CardHeader title="Today's lessons" />
        <div className="space-y-2">
          {LESSONS_TODAY.map(l => (
            <div key={l.sub} className="flex items-center gap-3 p-3 rounded-xl transition-all"
              style={{ background: l.active?`${l.color}10`:'transparent', border:`1px solid ${l.active?l.color+'30':'transparent'}` }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[18px] shrink-0"
                style={{ background:`${l.color}20`, color:l.color }}>
                {l.done?'✅':l.active?'▶':'📖'}
              </div>
              <div className="flex-1">
                <div className="text-[13px] font-semibold text-[var(--c-ink-0)]">{l.topic}</div>
                <div className="text-[11px] text-[var(--c-ink-3)] mt-0.5">{l.sub}</div>
              </div>
              {l.done   && <Chip variant="green" size="sm">Done</Chip>}
              {l.active && <Button variant="primary" size="sm" style={{ background:`${l.color}`, color:'#fff' }}>Continue</Button>}
              {!l.done && !l.active && <Chip variant="default" size="sm">Locked</Chip>}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── Student Roadmap ───────────────────────────────────────────────────────────
function StudentRoadmap() {
  const weeks = Array.from({ length:13 },(_,i)=>i+1);
  return (
    <div>
      <PageHeader eyebrow="Student" title="My roadmap" subtitle="Term 3 · 9 of 13 weeks complete" />
      <ProgressBar value={69} className="mb-1" />
      <div className="text-[12px] text-[var(--c-ink-3)] mb-5">Week 9 of 13 · 69% complete</div>
      <div className="space-y-2">
        {weeks.map(w => {
          const done=w<9, current=w===9, locked=w>9;
          return (
            <div key={w} className="flex items-center gap-3 p-3 rounded-xl transition-all"
              style={{ background:current?'rgba(249,112,102,0.08)':'transparent', border:`1px solid ${current?'rgba(249,112,102,0.25)':'var(--c-line-1)'}` }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0"
                style={{ background:done?'var(--c-green-400)':current?'var(--c-coral-400)':'var(--c-surface-4)',
                         color:done||current?'#fff':'var(--c-ink-4)' }}>
                {done?'✓':w}
              </div>
              <div className="flex-1">
                <div className="text-[13px] font-semibold" style={{ color:locked?'var(--c-ink-4)':'var(--c-ink-1)' }}>Week {w}</div>
                <div className="text-[11px] text-[var(--c-ink-4)] mt-0.5">
                  {done?'5 lessons complete':current?'In progress — 3 of 5 done':'5 lessons'}
                </div>
              </div>
              {done    && <Chip variant="green"   size="sm">Done</Chip>}
              {current && <Chip variant="coral"   size="sm">Current</Chip>}
              {locked  && <i className="ti ti-lock text-[var(--c-ink-4)]" aria-hidden="true"/>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Student Badges ────────────────────────────────────────────────────────────
const ALL_BADGES = [
  {e:'⭐',name:'Star Reader',  desc:'Read 10 lessons',     earned:true },
  {e:'🔥',name:'On Fire',      desc:'7-day streak',         earned:true },
  {e:'🧮',name:'Maths Pro',    desc:'Score 90%+ in Maths', earned:true },
  {e:'📚',name:'Bookworm',     desc:'Complete 20 lessons',  earned:true },
  {e:'🌟',name:'All Rounder',  desc:'All subjects done',    earned:true },
  {e:'🏆',name:'Top Scorer',   desc:'Class rank #1',        earned:false},
  {e:'🚀',name:'Speed Reader', desc:'5 lessons in 1 day',   earned:false},
  {e:'💡',name:'Quiz Whiz',    desc:'10 perfect quizzes',   earned:false},
];

function StudentBadges() {
  return (
    <div>
      <PageHeader eyebrow="Student" title="My badges" subtitle={`${ALL_BADGES.filter(b=>b.earned).length} earned · ${ALL_BADGES.filter(b=>!b.earned).length} to unlock`} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {ALL_BADGES.map(b => (
          <div key={b.name} className="text-center p-5 rounded-xl"
            style={{ background:b.earned?'rgba(249,112,102,0.08)':'var(--c-surface-2)', border:`1px solid ${b.earned?'rgba(249,112,102,0.2)':'var(--c-line-1)'}` }}>
            <div className="text-[36px] mb-2" style={{ opacity:b.earned?1:0.2 }}>{b.e}</div>
            <div className="text-[12px] font-bold" style={{ color:b.earned?'var(--c-ink-0)':'var(--c-ink-4)' }}>{b.name}</div>
            <div className="text-[10px] text-[var(--c-ink-4)] mt-1">{b.desc}</div>
            {b.earned && <Chip variant="coral" size="sm" className="mt-2">Earned</Chip>}
          </div>
        ))}
      </div>
    </div>
  );
}

function StudentLibrary() {
  return (
    <div>
      <PageHeader eyebrow="Student" title="Library" subtitle="All your lessons in one place." />
      <Card><Empty icon="books" message="Your full lesson library will appear here." /></Card>
    </div>
  );
}

function StudentProfile() {
  return (
    <div>
      <PageHeader eyebrow="Student" title="My profile" />
      <Card>
        <div className="flex items-center gap-4 mb-5">
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-[22px] font-bold shrink-0"
            style={{ background:'rgba(249,112,102,0.2)', color:'var(--c-coral-400)' }}>CO</div>
          <div>
            <div className="text-[18px] font-bold text-[var(--c-ink-0)]">Chidi Obi</div>
            <div className="text-[12px] text-[var(--c-ink-3)]">Primary 2A · TLF Lekki Academy</div>
          </div>
        </div>
        <KpiCard label="🔥 Current streak" value="12 days" deltaDir="up" delta="Best: 18 days" />
      </Card>
    </div>
  );
}

const STU_NAV = [
  { to:'/student',         end:true, icon:'home',    label:'Today'    },
  { to:'/student/roadmap', icon:'map',              label:'Roadmap'  },
  { to:'/student/library', icon:'books',            label:'Library'  },
  { to:'/student/badges',  icon:'trophy',           label:'Badges'   },
  { to:'/student/profile', icon:'user',             label:'Profile'  },
];

export function StudentApp() {
  return (
    <ProductTheme surface="student">
      {/* Lesson viewer gets its own full-screen layout — no AppShell */}
      <Routes>
        <Route path="lesson/:lessonId" element={<LessonViewer />} />
        <Route path="*" element={
          <AppShell navItems={STU_NAV} title="Student">
            <Routes>
              <Route index          element={<StudentToday />}   />
              <Route path="roadmap" element={<StudentRoadmap />} />
              <Route path="library" element={<StudentLibrary />} />
              <Route path="badges"  element={<StudentBadges />}  />
              <Route path="profile" element={<StudentProfile />} />
              <Route path="*"       element={<Navigate to="/student" replace />} />
            </Routes>
          </AppShell>
        } />
      </Routes>
    </ProductTheme>
  );
}

// ── TutorApp ──────────────────────────────────────────────────────────────────
function TutorDashboard() {
  const requests = [
    { name:'Mrs Okonkwo', sub:'Mathematics', level:'Primary 4', loc:'Victoria Island', rate:'₦5,000/hr' },
    { name:'Mr Suleiman', sub:'English',     level:'JSS 1',     loc:'Lekki Phase 1',  rate:'₦4,500/hr' },
    { name:'Dr Adeleke',  sub:'Basic Science',level:'Primary 6', loc:'Ikeja',          rate:'₦6,000/hr' },
  ];
  return (
    <div>
      <PageHeader eyebrow="Tutor · Lagos" title="Your dashboard" subtitle="3 new session requests this week" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Active students"  value="12"      deltaDir="up" delta="+2 this month"    icon="users"     />
        <KpiCard label="Pending requests" value="3"       deltaDir="flat" delta="Reply within 24h" icon="inbox"  />
        <KpiCard label="Your rating"      value="4.9 ★"  deltaDir="up" delta="28 reviews"        icon="star"     />
        <KpiCard label="This month"       value="₦145K"  deltaDir="up" delta="+22%"              icon="wallet"   />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Session requests" />
          <div className="space-y-3">
            {requests.map((r,i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-[var(--c-surface-3)] rounded-xl">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0"
                  style={{ background:'rgba(16,185,129,0.2)', color:'var(--c-emerald-400)' }}>
                  {r.name.split(' ').map(n=>n[0]).join('').slice(0,2)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-[var(--c-ink-0)]">{r.name}</div>
                  <div className="text-[11px] text-[var(--c-ink-3)]">{r.sub} · {r.level} · {r.loc}</div>
                  <div className="text-[11px] font-semibold mt-0.5" style={{ color:'var(--c-emerald-400)' }}>{r.rate}</div>
                </div>
                <Button variant="ghost" size="sm">View</Button>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title="Upcoming sessions" />
          {[
            { name:'Amara Okonkwo', time:'Sat 14 Jun · 10:00', mode:'Online'    },
            { name:'Bola Adeyemi',  time:'Sat 14 Jun · 14:00', mode:'In-person' },
            { name:'Chioma Nwosu',  time:'Sun 15 Jun · 09:00', mode:'Online'    },
          ].map((s,i) => (
            <div key={i} className="flex items-center gap-3 py-3 border-b border-[var(--c-line-1)] last:border-0">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                style={{ background:'rgba(16,185,129,0.2)', color:'var(--c-emerald-400)' }}>
                {s.name.split(' ').map(n=>n[0]).join('').slice(0,2)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-[var(--c-ink-0)]">{s.name}</div>
                <div className="text-[11px] text-[var(--c-ink-3)] mt-0.5">{s.time}</div>
              </div>
              <Chip variant={s.mode==='Online'?'teal':'gold'} size="sm">{s.mode}</Chip>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

const TUTOR_NAV = [
  { to:'/tutor',          end:true, icon:'layout-dashboard', label:'Dashboard' },
  { to:'/tutor/requests', icon:'inbox',          label:'Requests', badge:3     },
  { to:'/tutor/sessions', icon:'calendar-check', label:'Sessions'              },
  { to:'/tutor/students', icon:'users',          label:'My Students'           },
  { to:'/tutor/earnings', icon:'wallet',         label:'Earnings'              },
  { to:'/tutor/profile',  icon:'user-circle',    label:'My Profile'            },
];

export function TutorApp() {
  return (
    <ProductTheme surface="tutor">
      <AppShell navItems={TUTOR_NAV} title="Tutor">
        <Routes>
          <Route index          element={<TutorDashboard />} />
          <Route path="requests" element={<div><PageHeader title="Session requests" /><Card><Empty icon="inbox" message="Incoming session requests." /></Card></div>} />
          <Route path="sessions" element={<div><PageHeader title="Sessions" /><Card><Empty icon="calendar-check" message="Your upcoming and past sessions." /></Card></div>} />
          <Route path="students" element={<div><PageHeader title="My students" /><Card><Empty icon="users" message="Students you are tutoring." /></Card></div>} />
          <Route path="earnings" element={<div><PageHeader title="Earnings" /><Card><Empty icon="wallet" message="Earnings and payout history." /></Card></div>} />
          <Route path="profile"  element={<div><PageHeader title="My profile" /><Card><Empty icon="user-circle" message="Update your tutor profile and availability." /></Card></div>} />
          <Route path="*"        element={<Navigate to="/tutor" replace />} />
        </Routes>
      </AppShell>
    </ProductTheme>
  );
}

// ── SuperAdminApp ─────────────────────────────────────────────────────────────
function SAOverview() {
  const schools = [
    { name:'TLF Lekki Academy',     students:247, att:94, status:'Pilot'  },
    { name:'Bright Future School',  students:312, att:91, status:'Active' },
    { name:'New Horizon Academy',   students:189, att:88, status:'Active' },
    { name:'Grace International',   students:423, att:96, status:'Active' },
    { name:'Discovery School',      students:156, att:85, status:'Trial'  },
  ];
  const health = [
    { label:'Supabase uptime',       value:'99.9%',      icon:'server',    color:'var(--c-green-400)'  },
    { label:'API response avg',      value:'142ms',       icon:'bolt',      color:'var(--c-green-400)'  },
    { label:'Lesson content',        value:'67% covered', icon:'book-2',    color:'var(--product-accent)'},
    { label:'Active sessions',       value:'84 now',      icon:'users',     color:'var(--c-violet-400)' },
    { label:'Edge functions',        value:'10 deployed', icon:'code',      color:'var(--c-teal-400)'   },
    { label:'Storage used',          value:'12.4 GB',     icon:'database',  color:'var(--c-sky-400)'    },
  ];
  return (
    <div>
      <PageHeader eyebrow="Super Admin · Platform" title="TTA EOS Platform" subtitle="Live across Nigeria · 12 pilot schools" />
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        <KpiCard label="Total students"  value="2,847"  deltaDir="up" delta="+124 this month"  icon="users"         />
        <KpiCard label="Schools"         value="12"     deltaDir="up" delta="3 pending onboard" icon="building-school"/>
        <KpiCard label="Teachers"        value="186"    deltaDir="up" delta="+12"               icon="chalkboard"    />
        <KpiCard label="Platform revenue"value="₦8.4M" deltaDir="up" delta="+34% MoM"          icon="receipt-2"     />
        <KpiCard label="Avg attendance"  value="94%"   deltaDir="up" delta="Platform-wide"     icon="calendar-stats"/>
        <KpiCard label="Content coverage"value="67%"   deltaDir="up" delta="NERDC aligned"     icon="book-2"        />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card padding={false}>
          <div className="px-5 pt-5 pb-3">
            <h3 className="font-heading font-semibold text-[14px] text-[var(--c-ink-1)]">School performance</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--c-line-2)]">
                  {['School','Students','Attendance','Status'].map(h=>(
                    <th key={h} className="text-left px-5 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--c-ink-3)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {schools.map((s,i)=>(
                  <tr key={i} className="border-b border-[var(--c-line-1)] last:border-0 hover:bg-[var(--c-surface-3)] transition-colors">
                    <td className="px-5 py-3 font-medium text-[var(--c-ink-0)]">{s.name}</td>
                    <td className="px-5 py-3 text-[var(--c-ink-2)]">{s.students}</td>
                    <td className="px-5 py-3 min-w-[120px]">
                      <div className="flex items-center gap-2">
                        <ProgressBar value={s.att} color="var(--product-accent)" className="flex-1"/>
                        <span className="text-[11px] text-[var(--c-ink-3)] w-8 text-right">{s.att}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3"><Chip variant={s.status==='Active'?'green':s.status==='Pilot'?'gold':'teal'} size="sm">{s.status}</Chip></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card>
          <CardHeader title="Platform health" />
          {health.map((m,i)=>(
            <div key={i} className="flex items-center gap-3 py-2.5 border-b border-[var(--c-line-1)] last:border-0">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background:`${m.color}20`, color:m.color }}>
                <i className={`ti ti-${m.icon} text-[16px]`} aria-hidden="true"/>
              </div>
              <div className="flex-1 text-[13px] text-[var(--c-ink-2)]">{m.label}</div>
              <div className="font-semibold text-[13px]" style={{ color:m.color }}>{m.value}</div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

const SA_NAV = [
  { to:'/superadmin',          end:true, icon:'layout-dashboard',  label:'Platform overview' },
  { to:'/superadmin/schools',  icon:'building-school', label:'Schools'                       },
  { to:'/superadmin/users',    icon:'users',           label:'All users'                     },
  { to:'/superadmin/content',  icon:'book-2',          label:'Content'                       },
  { to:'/superadmin/tutors',   icon:'user-star',       label:'Tutors'                        },
  { to:'/superadmin/impact',   icon:'chart-area',      label:'Impact'                        },
  { to:'/superadmin/revenue',  icon:'receipt-2',       label:'Revenue'                       },
  { to:'/superadmin/security', icon:'shield',          label:'Security'                      },
  { to:'/superadmin/settings', icon:'settings',        label:'Platform settings'             },
];

export function SuperAdminApp() {
  return (
    <ProductTheme surface="superadmin">
      <AppShell navItems={SA_NAV} title="Super Admin">
        <Routes>
          <Route index            element={<SAOverview />} />
          <Route path="schools"   element={<div><PageHeader title="Schools" /><Card><Empty icon="building-school" message="All partner schools." /></Card></div>} />
          <Route path="users"     element={<div><PageHeader title="All users" /><Card><Empty icon="users" message="Platform-wide user management." /></Card></div>} />
          <Route path="content"   element={<div><PageHeader title="Content" /><Card><Empty icon="book-2" message="Lesson and curriculum management." /></Card></div>} />
          <Route path="tutors"    element={<div><PageHeader title="Tutors" /><Card><Empty icon="user-star" message="Tutor marketplace management." /></Card></div>} />
          <Route path="impact"    element={<div><PageHeader title="Impact" /><Card><Empty icon="chart-area" message="Platform impact metrics." /></Card></div>} />
          <Route path="revenue"   element={<div><PageHeader title="Revenue" /><Card><Empty icon="receipt-2" message="Platform revenue and commissions." /></Card></div>} />
          <Route path="security"  element={<div><PageHeader title="Security" /><Card><Empty icon="shield" message="Security audit and access control." /></Card></div>} />
          <Route path="settings"  element={<div><PageHeader title="Platform settings" /><Card><Empty icon="settings" message="Global platform configuration." /></Card></div>} />
          <Route path="*"         element={<Navigate to="/superadmin" replace />} />
        </Routes>
      </AppShell>
    </ProductTheme>
  );
}
