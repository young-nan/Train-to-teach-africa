/**
 * HeadTeacher screens — Teachers · Students · Attendance · Performance · Interventions · Curriculum · Comms · Reports
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Icon } from '@/components/ui/Icon';
import {
  PageHeader, Card, CardHeader, KpiCard, Chip, Button,
  Avatar, Select, Input, ProgressBar, Tabs, LoadingScreen, Empty, Alert,
} from '@/components/ui';

// ── Shared mock helpers ───────────────────────────────────────────────────────
const MOCK_TEACHERS = [
  { id:'1', name:'Mrs Janet Adeyemi', class:'Primary 2A', lessons:5, attendance:96, grades:82, status:'active'  },
  { id:'2', name:'Mr Tunde Okonkwo',  class:'Primary 2B', lessons:4, attendance:88, grades:74, status:'active'  },
  { id:'3', name:'Ms Amina Ibrahim',  class:'Primary 3A', lessons:5, attendance:92, grades:80, status:'active'  },
  { id:'4', name:'Mrs Rose Chukwu',   class:'Nursery 2',  lessons:3, attendance:94, grades:78, status:'leave'   },
];

const MOCK_STUDENTS = [
  { id:'1', name:'Chidi Obi',    class:'Primary 2A', att:96, avg:82, status:'active'  },
  { id:'2', name:'Amara Okafor', class:'Primary 2A', att:62, avg:54, status:'at_risk' },
  { id:'3', name:'Fatima Bello', class:'Primary 2B', att:89, avg:78, status:'active'  },
  { id:'4', name:'Kemi Adeyemi', class:'Primary 3A', att:78, avg:48, status:'at_risk' },
  { id:'5', name:'Bola Johnson',  class:'Primary 2B', att:94, avg:88, status:'active'  },
  { id:'6', name:'Emeka Nwosu',   class:'Nursery 2',  att:91, avg:76, status:'active'  },
];

// ── HTTeachers ────────────────────────────────────────────────────────────────
export function HTTeachers() {
  return (
    <div>
      <PageHeader eyebrow="Head Teacher" title="Teachers" subtitle="Monitor teacher performance and lesson delivery.">
        <Button variant="ghost" icon="download">Export</Button>
      </PageHeader>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Total teachers"   value={MOCK_TEACHERS.length}                                        deltaDir="flat" icon="id-badge-2" />
        <KpiCard label="On leave"         value={MOCK_TEACHERS.filter(t=>t.status==='leave').length}          deltaDir="flat" icon="calendar-off" />
        <KpiCard label="Avg lesson rate"  value={`${Math.round(MOCK_TEACHERS.reduce((a,t)=>a+t.lessons,0)/MOCK_TEACHERS.length)}/5`} deltaDir="flat" icon="book-2" />
        <KpiCard label="Pending assessments" value="3"                                                        deltaDir="down" icon="clipboard" />
      </div>
      <Card padding={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[var(--c-line-2)]">
                {['Teacher','Class','Lessons (wk)','Attendance','Class avg','Status'].map(h=>(
                  <th key={h} className="text-left px-5 py-3 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--c-ink-3)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MOCK_TEACHERS.map(t=>(
                <tr key={t.id} className="border-b border-[var(--c-line-1)] last:border-0 hover:bg-[var(--c-surface-3)] transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={t.name} size="sm" />
                      <span className="font-medium text-[var(--c-ink-0)]">{t.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-[var(--c-ink-2)]">{t.class}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <ProgressBar value={(t.lessons/5)*100} className="w-16" color={t.lessons>=4?'var(--c-green-400)':'var(--product-accent)'} />
                      <span className="text-[11px] text-[var(--c-ink-2)]">{t.lessons}/5</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className="font-semibold" style={{color:t.attendance>=90?'var(--c-green-400)':'var(--product-accent)'}}>{t.attendance}%</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="font-semibold" style={{color:t.grades>=75?'var(--c-green-400)':'var(--product-accent)'}}>{t.grades}%</span>
                  </td>
                  <td className="px-5 py-3">
                    <Chip variant={t.status==='active'?'green':'amber'} size="sm">{t.status==='active'?'Active':'On leave'}</Chip>
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

// ── HTStudents ────────────────────────────────────────────────────────────────
export function HTStudents() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');

  const list = MOCK_STUDENTS.filter(s =>
    (!search || s.name.toLowerCase().includes(search.toLowerCase())) &&
    (!filter || s.status === filter)
  );

  return (
    <div>
      <PageHeader eyebrow="Head Teacher" title="All students" subtitle="View and monitor every student across all classes.">
        <Button variant="ghost" icon="download">Export</Button>
      </PageHeader>
      <div className="flex gap-3 mb-5 flex-wrap">
        <Input className="max-w-[240px]" placeholder="Search students…" value={search} onChange={e=>setSearch(e.target.value)} />
        <Select className="max-w-[160px]" value={filter} onChange={e=>setFilter(e.target.value)}>
          <option value="">All status</option>
          <option value="active">Active</option>
          <option value="at_risk">At risk</option>
        </Select>
      </div>
      <Card padding={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[var(--c-line-2)]">
                {['Student','Class','Attendance','Avg grade','Status'].map(h=>(
                  <th key={h} className="text-left px-5 py-3 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--c-ink-3)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map(s=>(
                <tr key={s.id} className="border-b border-[var(--c-line-1)] last:border-0 hover:bg-[var(--c-surface-3)] transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={s.name} size="sm" />
                      <span className="font-medium text-[var(--c-ink-0)]">{s.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-[var(--c-ink-2)]">{s.class}</td>
                  <td className="px-5 py-3 min-w-[120px]">
                    <div className="flex items-center gap-2">
                      <ProgressBar value={s.att} className="flex-1" color={s.att>=90?'var(--c-green-400)':s.att>=70?'var(--product-accent)':'var(--c-red-400)'} />
                      <span className="text-[11px] text-[var(--c-ink-2)] w-8 text-right">{s.att}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 min-w-[120px]">
                    <div className="flex items-center gap-2">
                      <ProgressBar value={s.avg} className="flex-1" color={s.avg>=70?'var(--c-green-400)':s.avg>=50?'var(--product-accent)':'var(--c-red-400)'} />
                      <span className="text-[11px] text-[var(--c-ink-2)] w-8 text-right">{s.avg}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <Chip variant={s.status==='active'?'green':'amber'} size="sm">{s.status==='active'?'Active':'At risk'}</Chip>
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

// ── HTAttendance ──────────────────────────────────────────────────────────────
export function HTAttendance() {
  const classes = [
    { name:'Primary 2A', present:24, total:25, trend:[92,94,96,95,96] },
    { name:'Primary 2B', present:20, total:23, trend:[84,86,88,87,88] },
    { name:'Primary 3A', present:25, total:27, trend:[90,91,92,93,92] },
    { name:'Nursery 2',  present:18, total:19, trend:[92,93,94,95,94] },
  ];
  return (
    <div>
      <PageHeader eyebrow="Head Teacher" title="Attendance" subtitle="School-wide attendance view across all classes.">
        <Button variant="ghost" icon="download">Export CSV</Button>
      </PageHeader>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {classes.map(c=>{
          const pct = Math.round((c.present/c.total)*100);
          return <KpiCard key={c.name} label={c.name} value={`${pct}%`} deltaDir={pct>=90?'up':'flat'} delta={`${c.present}/${c.total} present`} />;
        })}
      </div>
      <Card>
        <CardHeader title="Weekly trend — all classes" />
        <div className="space-y-4">
          {classes.map(c=>{
            const pct = Math.round((c.present/c.total)*100);
            const max = Math.max(...c.trend);
            return (
              <div key={c.name}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[13px] font-medium text-[var(--c-ink-1)]">{c.name}</span>
                  <span className="text-[13px] font-bold" style={{color:pct>=90?'var(--c-green-400)':'var(--product-accent)'}}>{pct}%</span>
                </div>
                <div className="flex items-end gap-1 h-10">
                  {c.trend.map((v,i)=>(
                    <div key={i} className="flex-1 rounded-t transition-all"
                      style={{ height:`${Math.round((v/max)*100)}%`, background:v>=90?'var(--c-green-400)':'var(--product-accent)', opacity:0.7 }} />
                  ))}
                </div>
                <div className="flex gap-1 mt-0.5">
                  {['M','T','W','T','F'].map((d,i)=>(
                    <div key={i} className="flex-1 text-[10px] text-center text-[var(--c-ink-4)]">{d}</div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ── HTPerformance ─────────────────────────────────────────────────────────────
export function HTPerformance() {
  const subjects = [
    { sub:'Mathematics',      avg:68, pass:72, trend:'up'   },
    { sub:'English Language', avg:74, pass:85, trend:'up'   },
    { sub:'Basic Science',    avg:81, pass:91, trend:'up'   },
    { sub:'Social Studies',   avg:71, pass:82, trend:'flat' },
    { sub:'CRS',              avg:77, pass:88, trend:'up'   },
  ];
  return (
    <div>
      <PageHeader eyebrow="Head Teacher" title="Academic performance" subtitle="School-wide subject averages and pass rates.">
        <Button variant="ghost" icon="download">Download report</Button>
      </PageHeader>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard label="School average"  value="74%"  deltaDir="up"   delta="+3% vs last term"  icon="chart-bar"     />
        <KpiCard label="Overall pass rate" value="82%" deltaDir="up"  delta="+5%"               icon="circle-check"  />
        <KpiCard label="Top performers"  value="34"   deltaDir="up"   delta="A grade this term" icon="trophy"        />
        <KpiCard label="At risk (failing)" value="12" deltaDir="down" delta="Needs intervention" icon="alert-triangle"/>
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Subject averages" />
          {subjects.map(s=>(
            <div key={s.sub} className="flex items-center gap-3 py-3 border-b border-[var(--c-line-1)] last:border-0">
              <div className="w-36 shrink-0 text-[13px] font-medium text-[var(--c-ink-1)] truncate">{s.sub}</div>
              <div className="flex-1">
                <ProgressBar value={s.avg} color={s.avg>=75?'var(--c-green-400)':s.avg>=60?'var(--product-accent)':'var(--c-red-400)'} />
              </div>
              <div className="text-[13px] font-semibold text-[var(--c-ink-0)] w-10 text-right">{s.avg}%</div>
              <Icon name={`trending-${s.trend==='up'?'up':'right'}`} className="text-[14px]"
                style={{color:s.trend==='up'?'var(--c-green-400)':'var(--c-ink-3)'}} />
            </div>
          ))}
        </Card>
        <Card>
          <CardHeader title="Pass rates by subject" />
          {subjects.map(s=>(
            <div key={s.sub} className="flex items-center gap-3 py-3 border-b border-[var(--c-line-1)] last:border-0">
              <div className="w-36 shrink-0 text-[12px] text-[var(--c-ink-2)] truncate">{s.sub}</div>
              <div className="flex-1">
                <ProgressBar value={s.pass} color="var(--c-teal-400)" />
              </div>
              <div className="text-[13px] font-semibold" style={{color:'var(--c-teal-400)'}}>{s.pass}%</div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

// ── HTInterventions (imports AdminInterventions logic but scoped to HT) ───────
export function HTInterventions() {
  const open = [
    { name:'Amara Okafor', class:'Primary 2A', type:'Attendance', severity:'high',   days:4  },
    { name:'Kemi Adeyemi', class:'Primary 3A', type:'Academic',   severity:'high',   days:14 },
    { name:'Bola Johnson',  class:'Primary 2B', type:'Behaviour',  severity:'medium', days:7  },
    { name:'Ngozi Eze',     class:'Nursery 2',  type:'Attendance', severity:'medium', days:3  },
  ];
  return (
    <div>
      <PageHeader eyebrow="Head Teacher" title="Interventions" subtitle="Students across all classes requiring support.">
        <Button variant="primary" icon="plus">Log intervention</Button>
      </PageHeader>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Open"      value={open.length}                               deltaDir="flat" icon="alert-triangle" />
        <KpiCard label="High risk" value={open.filter(i=>i.severity==='high').length} deltaDir="down" icon="alert-circle"  />
        <KpiCard label="Resolved (wk)" value="3"                                    deltaDir="up"   icon="circle-check"   />
        <KpiCard label="Teachers alerted" value="2"                                 deltaDir="flat" icon="id-badge-2"     />
      </div>
      <div className="space-y-3">
        {open.map((item,i)=>(
          <div key={i} className="p-4 bg-[var(--c-surface-2)] border rounded-xl"
            style={{borderColor:item.severity==='high'?'rgba(239,83,80,0.3)':'rgba(245,165,36,0.3)'}}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <Avatar name={item.name} />
                <div>
                  <div className="font-semibold text-[var(--c-ink-0)]">{item.name}</div>
                  <div className="text-[12px] text-[var(--c-ink-3)] mt-0.5">{item.class} · {item.type}</div>
                  <div className="flex gap-2 mt-2">
                    <Chip variant={item.severity==='high'?'red':'amber'} size="sm">{item.severity}</Chip>
                    <span className="text-[11px] text-[var(--c-ink-4)] self-center">Flagged {item.days} day{item.days!==1?'s':''} ago</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <Button variant="ghost" size="sm" icon="circle-check">Resolve</Button>
                <Button variant="ghost" size="sm" icon="message-dots">Message teacher</Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── HTCurriculum ──────────────────────────────────────────────────────────────
export function HTCurriculum() {
  const classes = [
    { name:'Primary 2A', teacher:'Mrs Adeyemi', covered:9, total:13, pct:69 },
    { name:'Primary 2B', teacher:'Mr Okonkwo',  covered:8, total:13, pct:62 },
    { name:'Primary 3A', teacher:'Ms Ibrahim',  covered:10,total:13, pct:77 },
    { name:'Nursery 2',  teacher:'Mrs Chukwu',  covered:7, total:13, pct:54 },
  ];
  return (
    <div>
      <PageHeader eyebrow="Head Teacher" title="Curriculum progress" subtitle="Lesson coverage tracking across all classes.">
        <Button variant="ghost" icon="download">Download scheme</Button>
      </PageHeader>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard label="School average"  value="66%"  deltaDir="up"   delta="On track for Term 3" icon="book-2"   />
        <KpiCard label="Best class"      value="77%"  deltaDir="up"   delta="Primary 3A"           icon="trophy"   />
        <KpiCard label="Behind schedule" value="1"    deltaDir="down" delta="Nursery 2"             icon="clock"    />
        <KpiCard label="Weeks remaining" value="4"    deltaDir="flat"                               icon="calendar" />
      </div>
      <Card>
        <CardHeader title="Coverage by class" />
        {classes.map(c=>(
          <div key={c.name} className="py-4 border-b border-[var(--c-line-1)] last:border-0">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="font-medium text-[var(--c-ink-0)] text-[13px]">{c.name}</span>
                <span className="text-[11px] text-[var(--c-ink-3)] ml-2">{c.teacher}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-bold text-[var(--c-ink-0)]">{c.covered}/{c.total} weeks</span>
                <Chip variant={c.pct>=70?'green':c.pct>=50?'amber':'red'} size="sm">{c.pct}%</Chip>
              </div>
            </div>
            <ProgressBar value={c.pct} color={c.pct>=70?'var(--c-green-400)':c.pct>=50?'var(--product-accent)':'var(--c-red-400)'} />
          </div>
        ))}
      </Card>
    </div>
  );
}

// ── HTComms ───────────────────────────────────────────────────────────────────
export function HTComms() {
  const msgs = [
    { from:'Mr Tunde Okonkwo',  role:'teacher', subject:'Concern re: Bola Johnson behaviour', time:'9:15 AM',  unread:true  },
    { from:'Mrs Janet Adeyemi', role:'teacher', subject:'Curriculum query — Week 10 plan',     time:'8:42 AM',  unread:true  },
    { from:'Admin',             role:'admin',   subject:'Term 3 assessment reminder',           time:'Yesterday',unread:false },
  ];
  return (
    <div>
      <PageHeader eyebrow="Head Teacher" title="Communications" subtitle="Messages from staff and administration.">
        <Button variant="primary" icon="plus">New message</Button>
      </PageHeader>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Unread"     value={msgs.filter(m=>m.unread).length} deltaDir="flat" icon="message-dots" />
        <KpiCard label="From teachers" value="4"  deltaDir="flat" icon="chalkboard"   />
        <KpiCard label="Sent today"   value="3"   deltaDir="flat" icon="send"         />
        <KpiCard label="Pending reply" value="2"  deltaDir="flat" icon="clock"        />
      </div>
      <Card padding={false}>
        {msgs.map((m,i)=>(
          <div key={i} className="flex items-start gap-4 px-5 py-4 border-b border-[var(--c-line-1)] last:border-0 hover:bg-[var(--c-surface-3)] cursor-pointer transition-colors">
            <div className="mt-1.5 w-2 h-2 rounded-full shrink-0" style={{background:m.unread?'var(--product-accent)':'transparent'}} />
            <Avatar name={m.from} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <span className={`text-[13px] ${m.unread?'font-bold text-[var(--c-ink-0)]':'font-medium text-[var(--c-ink-1)]'}`}>{m.from}</span>
                <span className="text-[11px] text-[var(--c-ink-4)] font-mono shrink-0">{m.time}</span>
              </div>
              <div className="text-[12px] text-[var(--c-ink-2)] truncate">{m.subject}</div>
            </div>
            <Chip variant={m.role==='teacher'?'teal':'gold'} size="sm">{m.role}</Chip>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ── HTReports ─────────────────────────────────────────────────────────────────
export function HTReports() {
  const reports = [
    { title:'Term 3 Attendance Summary',     type:'Attendance', status:'ready',    date:'Today'     },
    { title:'Academic Performance Report',   type:'Academic',   status:'ready',    date:'Today'     },
    { title:'Teacher Activity Report',       type:'Staff',      status:'pending',  date:'Generating'},
    { title:'Intervention Tracker',          type:'Welfare',    status:'ready',    date:'Yesterday' },
  ];
  return (
    <div>
      <PageHeader eyebrow="Head Teacher" title="Reports" subtitle="School performance and compliance reports.">
        <Button variant="primary" icon="file-plus">Generate report</Button>
      </PageHeader>
      <div className="space-y-3">
        {reports.map((r,i)=>(
          <div key={i} className="flex items-center gap-4 p-4 bg-[var(--c-surface-2)] border border-[var(--c-line-2)] rounded-xl hover:border-[var(--product-accent)] transition-colors">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
              style={{background:'rgba(34,184,166,0.15)',color:'var(--c-teal-400)'}}>
              <Icon name="file-analytics" className="text-[18px]" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-[var(--c-ink-0)] text-[13px]">{r.title}</div>
              <div className="text-[11px] text-[var(--c-ink-3)] mt-0.5">{r.type} · {r.date}</div>
            </div>
            <Chip variant={r.status==='ready'?'green':'amber'} size="sm">{r.status}</Chip>
            {r.status==='ready' && <Button variant="ghost" size="sm" icon="download">Download</Button>}
          </div>
        ))}
      </div>
    </div>
  );
}
