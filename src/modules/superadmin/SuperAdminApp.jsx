/**
 * SuperAdminApp.jsx — Full platform admin
 * Overview · Schools · Users · Content · Tutors · Impact · Revenue · Security · Settings
 */

import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { ProductTheme } from '@/components/layout/ProductThemeProvider';
import {
  PageHeader, Card, CardHeader, KpiCard, Chip, Button,
  Avatar, Input, Select, FormGroup, Textarea, Alert,
  ProgressBar, Tabs, LoadingScreen, Empty, StatRow, Divider,
} from '@/components/ui';

const NAV = [
  { to:'/superadmin',           end:true, icon:'layout-dashboard',  label:'Platform overview' },
  { to:'/superadmin/schools',   icon:'building-school', label:'Schools'                       },
  { to:'/superadmin/users',     icon:'users',           label:'All users'                     },
  { to:'/superadmin/content',   icon:'book-2',          label:'Content'                       },
  { to:'/superadmin/tutors',    icon:'user-star',       label:'Tutors'                        },
  { to:'/superadmin/impact',    icon:'chart-area',      label:'Impact hub'                    },
  { to:'/superadmin/revenue',   icon:'receipt-2',       label:'Revenue'                       },
  { to:'/superadmin/security',  icon:'shield',          label:'Security'                      },
  { to:'/superadmin/settings',  icon:'settings',        label:'Platform settings'             },
];

// ── Mock data ─────────────────────────────────────────────────────────────────
const MOCK_SCHOOLS = [
  { id:'1', name:'TLF Lekki Academy',     city:'Lagos',   students:247, teachers:12, att:94, status:'pilot',  joined:'Sep 2024', plan:'Standard' },
  { id:'2', name:'Bright Future School',  city:'Lagos',   students:312, teachers:16, att:91, status:'active', joined:'Jan 2025', plan:'Standard' },
  { id:'3', name:'New Horizon Academy',   city:'Abuja',   students:189, teachers:10, att:88, status:'active', joined:'Jan 2025', plan:'Standard' },
  { id:'4', name:'Grace International',   city:'PH',      students:423, teachers:21, att:96, status:'active', joined:'Apr 2025', plan:'Premium'  },
  { id:'5', name:'Discovery School',      city:'Ibadan',  students:156, teachers: 8, att:85, status:'trial',  joined:'May 2025', plan:'Trial'    },
  { id:'6', name:'Excel Academy',         city:'Kano',    students:278, teachers:14, att:89, status:'active', joined:'Sep 2024', plan:'Standard' },
  { id:'7', name:'Sunrise Primary',       city:'Enugu',   students:134, teachers: 7, att:92, status:'active', joined:'Jan 2025', plan:'Standard' },
  { id:'8', name:'Royal Seeds School',    city:'Lagos',   students:198, teachers: 9, att:88, status:'pending',joined:'Jun 2025', plan:'—'        },
];

const MOCK_TUTORS = [
  { id:'1', name:'Mr Emeka Okafor',  subjects:['Mathematics','Basic Science'], rating:4.9, sessions:47, location:'Lagos',  status:'verified',  earnings:'₦726K' },
  { id:'2', name:'Mrs Chioma Eze',   subjects:['English Language'],             rating:4.7, sessions:32, location:'Lagos',  status:'verified',  earnings:'₦480K' },
  { id:'3', name:'Dr Bola Adeyemi',  subjects:['Mathematics','Physics'],        rating:5.0, sessions:28, location:'Lagos',  status:'verified',  earnings:'₦560K' },
  { id:'4', name:'Miss Ngozi Bello', subjects:['English Language','French'],    rating:4.6, sessions:18, location:'Abuja',  status:'pending',   earnings:'₦216K' },
  { id:'5', name:'Mr Ade Suleiman',  subjects:['Mathematics','Chemistry'],      rating:4.8, sessions:41, location:'PH',     status:'verified',  earnings:'₦615K' },
];

const STATUS_VARIANT = { active:'green', pilot:'gold', trial:'teal', pending:'amber', verified:'green', suspended:'red' };

// ── SA Overview ───────────────────────────────────────────────────────────────
function SAOverview() {
  const totalStudents = MOCK_SCHOOLS.reduce((a,s)=>a+s.students,0);
  const totalTeachers = MOCK_SCHOOLS.reduce((a,s)=>a+s.teachers,0);
  const avgAtt        = Math.round(MOCK_SCHOOLS.reduce((a,s)=>a+s.att,0)/MOCK_SCHOOLS.length);

  const health = [
    { label:'Supabase uptime',        value:'99.9%',       icon:'server',    color:'var(--c-green-400)'   },
    { label:'API avg response',        value:'142 ms',      icon:'bolt',      color:'var(--c-green-400)'   },
    { label:'Edge functions deployed', value:'10',          icon:'code',      color:'var(--c-teal-400)'    },
    { label:'Active sessions now',     value:'84',          icon:'users',     color:'var(--c-violet-400)'  },
    { label:'Lesson content coverage', value:'67%',         icon:'book-2',    color:'var(--product-accent)'},
    { label:'Storage used',            value:'12.4 GB',     icon:'database',  color:'var(--c-sky-400)'     },
    { label:'Error rate (24h)',        value:'0.02%',       icon:'alert',     color:'var(--c-green-400)'   },
    { label:'New signups today',       value:'14',          icon:'user-plus', color:'var(--c-emerald-400)' },
  ];

  return (
    <div>
      <PageHeader eyebrow="Super Admin · TTA Platform" title="Platform overview" subtitle={`Live across Nigeria · ${MOCK_SCHOOLS.filter(s=>s.status!=='pending').length} active schools`} >
        <Button variant="primary" icon="plus">Onboard school</Button>
        <Button variant="ghost" icon="download">Platform report</Button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        <KpiCard label="Total students"   value={totalStudents.toLocaleString()} deltaDir="up" delta="+124 this month"  icon="users"          />
        <KpiCard label="Schools"          value={MOCK_SCHOOLS.length}             deltaDir="up" delta="3 pending"        icon="building-school" />
        <KpiCard label="Teachers"         value={totalTeachers}                   deltaDir="up" delta="+12"              icon="chalkboard"      />
        <KpiCard label="Platform revenue" value="₦8.4M"                          deltaDir="up" delta="+34% MoM"         icon="receipt-2"       />
        <KpiCard label="Avg attendance"   value={`${avgAtt}%`}                   deltaDir="up" delta="Platform-wide"    icon="calendar-stats"  />
        <KpiCard label="Active tutors"    value={MOCK_TUTORS.filter(t=>t.status==='verified').length} deltaDir="up" delta="Verified" icon="user-star" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        {/* School table */}
        <Card padding={false}>
          <div className="px-5 pt-5 pb-3 flex items-center justify-between">
            <h3 className="font-heading font-semibold text-[14px] text-[var(--c-ink-1)]">Schools</h3>
            <Button variant="link" size="sm">View all →</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--c-line-2)]">
                  {['School','Students','Att.','Status'].map(h=>(
                    <th key={h} className="text-left px-5 py-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--c-ink-3)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MOCK_SCHOOLS.slice(0,6).map(s=>(
                  <tr key={s.id} className="border-b border-[var(--c-line-1)] last:border-0 hover:bg-[var(--c-surface-3)] transition-colors">
                    <td className="px-5 py-3 font-medium text-[var(--c-ink-0)]">{s.name}</td>
                    <td className="px-5 py-3 text-[var(--c-ink-2)]">{s.students}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <ProgressBar value={s.att} className="w-12" color={s.att>=90?'var(--c-green-400)':'var(--product-accent)'} />
                        <span className="text-[11px] text-[var(--c-ink-3)]">{s.att}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3"><Chip variant={STATUS_VARIANT[s.status]??'default'} size="sm">{s.status}</Chip></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Platform health */}
        <Card>
          <CardHeader title="Platform health" />
          <div className="grid grid-cols-2 gap-2">
            {health.map(m=>(
              <div key={m.label} className="flex items-center gap-2.5 p-2.5 bg-[var(--c-surface-3)] rounded-lg">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{background:`${m.color}20`,color:m.color}}>
                  <i className={`ti ti-${m.icon} text-[14px]`} aria-hidden="true"/>
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold" style={{color:m.color}}>{m.value}</div>
                  <div className="text-[10px] text-[var(--c-ink-4)] truncate">{m.label}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── SA Schools ────────────────────────────────────────────────────────────────
function SASchools() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatus] = useState('');
  const list = MOCK_SCHOOLS.filter(s=>
    (!search || s.name.toLowerCase().includes(search.toLowerCase()) || s.city.toLowerCase().includes(search.toLowerCase())) &&
    (!statusFilter || s.status === statusFilter)
  );

  return (
    <div>
      <PageHeader eyebrow="Super Admin" title="Schools" subtitle={`${MOCK_SCHOOLS.length} schools on platform`}>
        <Button variant="primary" icon="plus">Onboard school</Button>
        <Button variant="ghost" icon="download">Export</Button>
      </PageHeader>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        {['active','pilot','trial','pending'].map(st=>(
          <KpiCard key={st} label={st.charAt(0).toUpperCase()+st.slice(1)} value={MOCK_SCHOOLS.filter(s=>s.status===st).length} deltaDir="flat" />
        ))}
        <KpiCard label="Total schools" value={MOCK_SCHOOLS.length} deltaDir="up" delta="+3 this month" icon="building-school" />
      </div>
      <div className="flex gap-3 mb-5 flex-wrap">
        <Input className="max-w-[260px]" placeholder="Search schools…" value={search} onChange={e=>setSearch(e.target.value)} />
        <Select className="max-w-[160px]" value={statusFilter} onChange={e=>setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {['active','pilot','trial','pending'].map(s=><option key={s} value={s}>{s}</option>)}
        </Select>
      </div>
      <Card padding={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[var(--c-line-2)]">
                {['School','City','Students','Teachers','Attendance','Plan','Joined','Status',''].map(h=>(
                  <th key={h} className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--c-ink-3)] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map(s=>(
                <tr key={s.id} className="border-b border-[var(--c-line-1)] last:border-0 hover:bg-[var(--c-surface-3)] transition-colors">
                  <td className="px-4 py-3 font-semibold text-[var(--c-ink-0)] whitespace-nowrap">{s.name}</td>
                  <td className="px-4 py-3 text-[var(--c-ink-2)]">{s.city}</td>
                  <td className="px-4 py-3 text-[var(--c-ink-2)]">{s.students}</td>
                  <td className="px-4 py-3 text-[var(--c-ink-2)]">{s.teachers}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <ProgressBar value={s.att} className="w-14" color={s.att>=90?'var(--c-green-400)':'var(--product-accent)'} />
                      <span className="text-[11px] text-[var(--c-ink-3)]">{s.att}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3"><Chip variant={s.plan==='Premium'?'violet':s.plan==='Trial'?'teal':'default'} size="sm">{s.plan}</Chip></td>
                  <td className="px-4 py-3 font-mono text-[11px] text-[var(--c-ink-4)]">{s.joined}</td>
                  <td className="px-4 py-3"><Chip variant={STATUS_VARIANT[s.status]??'default'} size="sm">{s.status}</Chip></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" icon="eye">View</Button>
                      <Button variant="ghost" size="sm" icon="dots-vertical" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ── SA Users ──────────────────────────────────────────────────────────────────
function SAUsers() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRole] = useState('');

  const MOCK_USERS = [
    { name:'Mrs Janet Adeyemi',  role:'teacher',      school:'TLF Lekki Academy',    email:'j.adeyemi@tlflekki.edu.ng', status:'active',   joined:'Sep 2024' },
    { name:'Mr Chidi Obi',       role:'parent',       school:'TLF Lekki Academy',    email:'chidi.obi@gmail.com',        status:'active',   joined:'Oct 2024' },
    { name:'Ms Amina Ibrahim',   role:'teacher',      school:'New Horizon Academy',  email:'a.ibrahim@newhorizon.ng',    status:'active',   joined:'Jan 2025' },
    { name:'Dr Bola Adeyemi',    role:'tutor',        school:'—',                    email:'bola@tutors.ng',             status:'active',   joined:'Nov 2024' },
    { name:'Mr Tunde Okonkwo',   role:'teacher',      school:'TLF Lekki Academy',    email:'t.okonkwo@tlflekki.edu.ng', status:'active',   joined:'Sep 2024' },
    { name:'Mrs Ngozi Eze',      role:'school_admin', school:'Grace International',  email:'n.eze@graceinternational.ng',status:'active',   joined:'Apr 2025' },
    { name:'Mr Emeka Suleiman',  role:'parent',       school:'Bright Future School', email:'emeka.s@yahoo.com',          status:'inactive', joined:'Jan 2025' },
  ];

  const ROLE_VARIANT = { teacher:'teal', parent:'rose', tutor:'emerald', school_admin:'gold', super_admin:'violet', student:'coral' };

  const list = MOCK_USERS.filter(u=>
    (!search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())) &&
    (!roleFilter || u.role === roleFilter)
  );

  return (
    <div>
      <PageHeader eyebrow="Super Admin" title="All users" subtitle="Platform-wide user management.">
        <Button variant="ghost" icon="download">Export users</Button>
      </PageHeader>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        {[
          {label:'Teachers',    role:'teacher',      icon:'chalkboard'},
          {label:'Parents',     role:'parent',       icon:'users'},
          {label:'Students',    role:'student',      icon:'school'},
          {label:'Tutors',      role:'tutor',        icon:'user-star'},
          {label:'School admins',role:'school_admin',icon:'shield'},
        ].map(r=>(
          <KpiCard key={r.label} label={r.label} value={MOCK_USERS.filter(u=>u.role===r.role).length} deltaDir="flat" icon={r.icon} />
        ))}
      </div>
      <div className="flex gap-3 mb-5 flex-wrap">
        <Input className="max-w-[260px]" placeholder="Search users…" value={search} onChange={e=>setSearch(e.target.value)} />
        <Select className="max-w-[180px]" value={roleFilter} onChange={e=>setRole(e.target.value)}>
          <option value="">All roles</option>
          {['teacher','parent','student','tutor','school_admin'].map(r=><option key={r} value={r}>{r.replace('_',' ')}</option>)}
        </Select>
      </div>
      <Card padding={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[var(--c-line-2)]">
                {['User','Role','School','Email','Status','Joined',''].map(h=>(
                  <th key={h} className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--c-ink-3)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((u,i)=>(
                <tr key={i} className="border-b border-[var(--c-line-1)] last:border-0 hover:bg-[var(--c-surface-3)] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={u.name} size="sm" />
                      <span className="font-medium text-[var(--c-ink-0)] whitespace-nowrap">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3"><Chip variant={ROLE_VARIANT[u.role]??'default'} size="sm">{u.role.replace('_',' ')}</Chip></td>
                  <td className="px-4 py-3 text-[var(--c-ink-2)] whitespace-nowrap">{u.school}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-[var(--c-ink-3)]">{u.email}</td>
                  <td className="px-4 py-3"><Chip variant={u.status==='active'?'green':'default'} size="sm">{u.status}</Chip></td>
                  <td className="px-4 py-3 font-mono text-[11px] text-[var(--c-ink-4)]">{u.joined}</td>
                  <td className="px-4 py-3"><Button variant="ghost" size="sm" icon="dots-vertical" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ── SA Content ────────────────────────────────────────────────────────────────
function SAContent() {
  const stats = [
    { level:'Nursery 1',  lessons:42, subjects:5, completePct:95 },
    { level:'Nursery 2',  lessons:45, subjects:5, completePct:95 },
    { level:'Nursery 3',  lessons:48, subjects:6, completePct:90 },
    { level:'Primary 1',  lessons:65, subjects:8, completePct:88 },
    { level:'Primary 2',  lessons:65, subjects:8, completePct:85 },
    { level:'Primary 3',  lessons:65, subjects:8, completePct:72 },
    { level:'Primary 4',  lessons:65, subjects:8, completePct:45 },
    { level:'Primary 5',  lessons:65, subjects:8, completePct:30 },
    { level:'Primary 6',  lessons:65, subjects:8, completePct:15 },
  ];
  const total     = stats.reduce((a,s)=>a+s.lessons,0);
  const completed = stats.reduce((a,s)=>a+Math.round(s.lessons*(s.completePct/100)),0);

  return (
    <div>
      <PageHeader eyebrow="Super Admin" title="Content management" subtitle="NERDC/NAPPS lesson library and curriculum coverage.">
        <Button variant="primary" icon="plus">Upload lessons</Button>
        <Button variant="ghost" icon="download">Export catalogue</Button>
      </PageHeader>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Total lessons"     value={total}                                                  deltaDir="flat" icon="book-2"      />
        <KpiCard label="Complete"          value={completed}                                              deltaDir="up"   icon="check"       />
        <KpiCard label="Overall coverage"  value={`${Math.round((completed/total)*100)}%`}               deltaDir="up"   icon="chart-bar"   />
        <KpiCard label="Class levels"      value={stats.length}                                           deltaDir="flat" icon="layers"      />
      </div>
      <Card>
        <CardHeader title="Lesson coverage by class level" />
        {stats.map(s=>(
          <div key={s.level} className="flex items-center gap-4 py-3 border-b border-[var(--c-line-1)] last:border-0">
            <div className="w-24 shrink-0 font-medium text-[var(--c-ink-1)] text-[13px]">{s.level}</div>
            <div className="text-[11px] text-[var(--c-ink-3)] w-16 shrink-0">{s.subjects} subjects</div>
            <div className="flex-1">
              <ProgressBar value={s.completePct}
                color={s.completePct>=80?'var(--c-green-400)':s.completePct>=50?'var(--product-accent)':'var(--c-rose-400)'} />
            </div>
            <div className="text-[12px] font-semibold text-[var(--c-ink-0)] w-12 text-right">{Math.round(s.lessons*(s.completePct/100))}/{s.lessons}</div>
            <Chip variant={s.completePct>=80?'green':s.completePct>=50?'amber':'red'} size="sm">{s.completePct}%</Chip>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ── SA Tutors ─────────────────────────────────────────────────────────────────
function SATutors() {
  const [tab, setTab] = useState('all');
  const list = tab==='pending' ? MOCK_TUTORS.filter(t=>t.status==='pending') : MOCK_TUTORS;

  return (
    <div>
      <PageHeader eyebrow="Super Admin" title="Tutor marketplace" subtitle="Verify tutors, track performance, manage the marketplace.">
        <Button variant="ghost" icon="download">Export</Button>
      </PageHeader>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Total tutors"    value={MOCK_TUTORS.length}                                deltaDir="flat" icon="user-star" />
        <KpiCard label="Verified"        value={MOCK_TUTORS.filter(t=>t.status==='verified').length} deltaDir="flat" icon="shield-check" />
        <KpiCard label="Pending review"  value={MOCK_TUTORS.filter(t=>t.status==='pending').length} deltaDir="flat" icon="clock" />
        <KpiCard label="Sessions (month)"value="124"                                               deltaDir="up" delta="+18%" icon="calendar-check" />
      </div>
      <Tabs tabs={[{key:'all',label:'All tutors'},{key:'pending',label:'Pending verification',count:MOCK_TUTORS.filter(t=>t.status==='pending').length}]} active={tab} onChange={setTab} />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.map(t=>(
          <Card key={t.id}>
            <div className="flex items-start gap-3 mb-3">
              <Avatar name={t.name} size="lg" />
              <div className="flex-1">
                <div className="font-heading font-semibold text-[14px] text-[var(--c-ink-0)]">{t.name}</div>
                <div className="text-[11px] text-[var(--c-ink-3)] mt-0.5">📍 {t.location}</div>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-[12px] text-[var(--c-amber-400)]">★</span>
                  <span className="text-[11px] font-semibold text-[var(--c-ink-1)]">{t.rating}</span>
                  <span className="text-[10px] text-[var(--c-ink-3)]">· {t.sessions} sessions</span>
                </div>
              </div>
              <Chip variant={STATUS_VARIANT[t.status]??'default'} size="sm">{t.status}</Chip>
            </div>
            <div className="flex flex-wrap gap-1 mb-3">
              {t.subjects.map(s=><Chip key={s} variant="default" size="sm">{s}</Chip>)}
            </div>
            <div className="flex items-center justify-between text-[12px] mb-3">
              <span className="text-[var(--c-ink-3)]">Earnings (YTD)</span>
              <span className="font-bold text-[var(--c-emerald-400)]">{t.earnings}</span>
            </div>
            <div className="flex gap-2">
              {t.status==='pending' && <Button variant="primary" size="sm" icon="shield-check" className="flex-1 justify-center">Verify</Button>}
              {t.status==='verified' && <Button variant="ghost" size="sm" icon="eye" className="flex-1 justify-center">View profile</Button>}
              <Button variant="ghost" size="sm" icon="dots-vertical" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── SA Impact ─────────────────────────────────────────────────────────────────
function SAImpact() {
  const metrics = [
    { label:'Students reached',    value:'2,847',  delta:'+124 this month',  icon:'users',        color:'var(--c-teal-400)'    },
    { label:'Lessons completed',   value:'48,291', delta:'+6,200 this month', icon:'book-2',       color:'var(--product-accent)'},
    { label:'Platform att. rate',  value:'91%',    delta:'+2% vs last term',  icon:'calendar-stats',color:'var(--c-green-400)'  },
    { label:'Parent engagement',   value:'74%',    delta:'+8% this term',     icon:'heart',        color:'var(--c-rose-400)'    },
    { label:'Schools with >90% att','value':'4',   delta:'Of 8 active',      icon:'building-school',color:'var(--c-emerald-400)'},
    { label:'Teacher lesson rate', value:'87%',    delta:'of planned',        icon:'chalkboard',   color:'var(--c-sky-400)'     },
  ];
  return (
    <div>
      <PageHeader eyebrow="Super Admin" title="Impact hub" subtitle="Platform-wide learning outcomes and impact metrics.">
        <Button variant="ghost" icon="download">Donor report (PDF)</Button>
        <Button variant="ghost" icon="file-analytics">Government report</Button>
      </PageHeader>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        {metrics.map(m=>(
          <div key={m.label} className="bg-[var(--c-surface-2)] border border-[var(--c-line-2)] rounded-xl p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="text-[11px] font-mono uppercase tracking-[0.1em] text-[var(--c-ink-3)]">{m.label}</div>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{background:`${m.color}20`,color:m.color}}>
                <i className={`ti ti-${m.icon} text-[16px]`} aria-hidden="true"/>
              </div>
            </div>
            <div className="font-heading text-[28px] font-bold text-[var(--c-ink-0)]">{m.value}</div>
            <div className="text-[11px] text-[var(--c-green-400)] mt-1">↑ {m.delta}</div>
          </div>
        ))}
      </div>
      <Card>
        <CardHeader title="Monthly lesson completions trend" />
        <div className="flex items-end gap-2 h-32">
          {[28400,31200,29800,33400,38100,41200,44800,48291].map((v,i)=>{
            const max=48291;
            const months=['Nov','Dec','Jan','Feb','Mar','Apr','May','Jun'];
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full rounded-t" style={{height:`${Math.round((v/max)*100)}%`,background:'var(--product-accent)',opacity:0.7,minHeight:'4px'}} />
                <div className="text-[9px] text-[var(--c-ink-4)]">{months[i]}</div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ── SA Revenue ────────────────────────────────────────────────────────────────
function SARevenue() {
  const monthly = [
    {month:'Jan',school:420000,tutor:85000},{month:'Feb',school:480000,tutor:92000},
    {month:'Mar',school:510000,tutor:104000},{month:'Apr',school:490000,tutor:98000},
    {month:'May',school:580000,tutor:118000},{month:'Jun',school:640000,tutor:135000},
  ];

  return (
    <div>
      <PageHeader eyebrow="Super Admin" title="Revenue" subtitle="Platform earnings, school subscriptions, tutor commissions.">
        <Button variant="ghost" icon="download">Financial report</Button>
      </PageHeader>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Total revenue (YTD)" value="₦8.4M"   deltaDir="up" delta="+34% MoM"       icon="trending-up"  />
        <KpiCard label="School subs (MRR)"   value="₦640K"   deltaDir="up" delta="This month"     icon="building-school"/>
        <KpiCard label="Tutor commissions"   value="₦135K"   deltaDir="up" delta="This month 15%" icon="user-star"    />
        <KpiCard label="Outstanding"         value="₦124K"   deltaDir="down" delta="4 schools"    icon="alert-circle" />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Monthly revenue breakdown (₦)" />
          <div className="flex items-end gap-2 h-36 mb-2">
            {monthly.map((m,i)=>{
              const maxTotal=Math.max(...monthly.map(x=>x.school+x.tutor));
              const total=m.school+m.tutor;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                  <div className="w-full flex flex-col" style={{height:`${Math.round((total/maxTotal)*100)}%`,minHeight:'8px'}}>
                    <div className="w-full rounded-t" style={{height:`${Math.round((m.school/total)*100)}%`,background:'var(--product-accent)',opacity:0.8}} />
                    <div className="w-full" style={{height:`${Math.round((m.tutor/total)*100)}%`,background:'var(--c-emerald-400)',opacity:0.7}} />
                  </div>
                  <div className="text-[9px] text-[var(--c-ink-4)]">{m.month}</div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-4 pt-2 border-t border-[var(--c-line-1)]">
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--c-ink-2)]">
              <div className="w-3 h-3 rounded-sm" style={{background:'var(--product-accent)'}} />School subs
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--c-ink-2)]">
              <div className="w-3 h-3 rounded-sm" style={{background:'var(--c-emerald-400)'}} />Tutor commission
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader title="Revenue by school (this month)" />
          {MOCK_SCHOOLS.filter(s=>s.status!=='pending').slice(0,6).map((s,i)=>{
            const rev=[640000,580000,420000,390000,310000,280000][i];
            const maxRev=640000;
            return (
              <div key={s.id} className="flex items-center gap-3 py-2.5 border-b border-[var(--c-line-1)] last:border-0">
                <div className="text-[12px] text-[var(--c-ink-2)] w-36 shrink-0 truncate">{s.name}</div>
                <div className="flex-1">
                  <ProgressBar value={Math.round((rev/maxRev)*100)} color="var(--product-accent)" />
                </div>
                <div className="text-[12px] font-bold text-[var(--c-ink-0)] w-16 text-right font-mono">₦{(rev/1000).toFixed(0)}K</div>
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}

// ── SA Security ───────────────────────────────────────────────────────────────
function SASecurity() {
  const events = [
    { event:'Failed login attempt',     ip:'102.89.3.47',  user:'unknown@mail.com',    time:'14:23 today',   type:'warning'  },
    { event:'Admin settings changed',   ip:'197.210.84.12',user:'admin@tlflekki.ng',   time:'09:15 today',   type:'info'     },
    { event:'New device login',         ip:'41.58.22.100',  user:'t.okonkwo@tlf.ng',  time:'08:42 today',   type:'info'     },
    { event:'Password reset',           ip:'105.112.88.34', user:'parent@gmail.com',  time:'Yesterday',      type:'info'     },
    { event:'Suspicious activity (5x login)', ip:'197.255.12.4',user:'—',             time:'2 days ago',    type:'error'    },
  ];
  const typeVariant={warning:'amber',info:'teal',error:'red',success:'green'};
  const typeIcon={warning:'alert-triangle',info:'info-circle',error:'alert-circle',success:'circle-check'};

  return (
    <div>
      <PageHeader eyebrow="Super Admin" title="Security" subtitle="Platform-wide security audit and access control.">
        <Button variant="ghost" icon="download">Export security log</Button>
      </PageHeader>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Active sessions"   value="84"  deltaDir="flat" icon="users"         />
        <KpiCard label="Failed logins (24h)" value="3" deltaDir="flat" icon="lock"          />
        <KpiCard label="Password resets (wk)" value="12" deltaDir="flat" icon="key"        />
        <KpiCard label="Blocked IPs"       value="2"   deltaDir="flat" icon="shield-x"     />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Security event log" />
          {events.map((e,i)=>(
            <div key={i} className="flex gap-3 p-3 rounded-lg mb-2 last:mb-0"
              style={{background:`var(--c-surface-3)`,borderLeft:`3px solid var(--c-${typeVariant[e.type]}-400,var(--c-teal-400))`}}>
              <i className={`ti ti-${typeIcon[e.type]} text-[16px] mt-0.5 shrink-0`}
                style={{color:`var(--c-${typeVariant[e.type]}-400,var(--c-teal-400))`}} aria-hidden="true"/>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-[var(--c-ink-1)]">{e.event}</div>
                <div className="text-[11px] text-[var(--c-ink-3)] mt-0.5 font-mono">{e.ip} · {e.user}</div>
              </div>
              <div className="text-[10px] font-mono text-[var(--c-ink-4)] shrink-0">{e.time}</div>
            </div>
          ))}
        </Card>
        <Card>
          <CardHeader title="Access control" />
          <Alert type="info" className="mb-4">Platform-wide 2FA is recommended for all school admin accounts.</Alert>
          <div className="space-y-3">
            {[
              {label:'Enforce 2FA — school admins',   enabled:false},
              {label:'Enforce 2FA — head teachers',   enabled:false},
              {label:'IP whitelist for super admins', enabled:true },
              {label:'Automatic session timeout',     enabled:true },
              {label:'Suspicious activity alerts',    enabled:true },
            ].map(opt=>(
              <div key={opt.label} className="flex items-center justify-between py-2 border-b border-[var(--c-line-1)] last:border-0">
                <span className="text-[13px] text-[var(--c-ink-1)]">{opt.label}</span>
                <div className={`w-10 h-5 rounded-full relative transition-colors ${opt.enabled?'bg-[var(--product-accent)]':'bg-[var(--c-surface-5)]'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${opt.enabled?'translate-x-5':'translate-x-0.5'}`} />
                </div>
              </div>
            ))}
          </div>
          <Button variant="primary" icon="device-floppy" className="mt-4">Save security settings</Button>
        </Card>
      </div>
    </div>
  );
}

// ── SA Platform Settings ──────────────────────────────────────────────────────
function SAPlatformSettings() {
  return (
    <div>
      <PageHeader eyebrow="Super Admin" title="Platform settings" subtitle="Global TTA EOS configuration." />
      <div className="grid lg:grid-cols-2 gap-4">
        {[
          { icon:'building-school', label:'School onboarding',    desc:'Configure onboarding flow, required documents, trial period length.'  },
          { icon:'receipt-2',       label:'Subscription plans',   desc:'Manage pricing tiers: Standard, Premium, Government, Trial.'           },
          { icon:'user-star',       label:'Tutor marketplace',    desc:'Commission rates, verification requirements, payout schedule.'          },
          { icon:'book-2',          label:'Content pipeline',     desc:'Curriculum upload workflow, quality review process.'                    },
          { icon:'brand-whatsapp',  label:'WhatsApp platform',    desc:'Platform-wide WhatsApp Business API config and templates.'              },
          { icon:'chart-area',      label:'Impact reporting',     desc:'Donor report templates, government data formats, export schedules.'     },
          { icon:'shield',          label:'Security policy',      desc:'Platform-wide password and session policies.'                           },
          { icon:'globe',           label:'Localisation',         desc:'Language support, currency, date and time formats.'                     },
        ].map(s=>(
          <Card key={s.label} className="cursor-pointer hover:border-[var(--product-accent)] transition-colors">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{background:'var(--product-accent)',color:'#1a1305',opacity:0.85}}>
                <i className={`ti ti-${s.icon} text-[18px]`} aria-hidden="true"/>
              </div>
              <div>
                <div className="font-semibold text-[var(--c-ink-0)] text-[14px]">{s.label}</div>
                <div className="text-[12px] text-[var(--c-ink-3)] mt-1 leading-relaxed">{s.desc}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── SuperAdminApp root ────────────────────────────────────────────────────────
export function SuperAdminApp() {
  return (
    <ProductTheme surface="superadmin">
      <AppShell navItems={NAV} title="Super Admin">
        <Routes>
          <Route index            element={<SAOverview />}          />
          <Route path="schools"   element={<SASchools />}           />
          <Route path="users"     element={<SAUsers />}             />
          <Route path="content"   element={<SAContent />}           />
          <Route path="tutors"    element={<SATutors />}            />
          <Route path="impact"    element={<SAImpact />}            />
          <Route path="revenue"   element={<SARevenue />}           />
          <Route path="security"  element={<SASecurity />}         />
          <Route path="settings"  element={<SAPlatformSettings />} />
          <Route path="*"         element={<Navigate to="/superadmin" replace />} />
        </Routes>
      </AppShell>
    </ProductTheme>
  );
}
