import { PageHeader, Card, CardHeader, KpiCard, Chip, Button, Avatar, Empty, ProgressBar } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';

const MOCK_PUPILS = [
  { id:'1', name:'Chidi Obi',      att:96, avg:82, status:'active'  },
  { id:'2', name:'Amara Okafor',   att:62, avg:54, status:'at_risk' },
  { id:'3', name:'Fatima Bello',   att:89, avg:78, status:'active'  },
  { id:'4', name:'Kemi Adeyemi',   att:78, avg:48, status:'at_risk' },
  { id:'5', name:'Bola Johnson',   att:94, avg:88, status:'active'  },
  { id:'6', name:'Ngozi Eze',      att:91, avg:76, status:'active'  },
];

export function TeacherClass() {
  return (
    <div>
      <PageHeader eyebrow="Teacher" title="My class" subtitle="Primary 2A · 25 students · Term 3">
        <Button variant="ghost" icon="download">Export list</Button>
        <Button variant="ghost" icon="message-dots">Message all parents</Button>
      </PageHeader>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Total students"  value="25"  deltaDir="flat" icon="users"        />
        <KpiCard label="Avg attendance"  value="89%" deltaDir="up"   icon="calendar-stats"/>
        <KpiCard label="Avg grade"       value="74%" deltaDir="up"   icon="chart-bar"    />
        <KpiCard label="At risk"          value="2"   deltaDir="down" icon="alert-triangle"/>
      </div>
      <Card padding={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[var(--c-line-2)]">
                {['Student','Attendance','Avg grade','Status',''].map(h => (
                  <th key={h} className="text-left px-5 py-3 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--c-ink-3)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MOCK_PUPILS.map(p => (
                <tr key={p.id} className="border-b border-[var(--c-line-1)] last:border-0 hover:bg-[var(--c-surface-3)] transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={p.name} size="sm" />
                      <span className="font-medium text-[var(--c-ink-0)]">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 min-w-[120px]">
                    <div className="flex items-center gap-2">
                      <ProgressBar value={p.att} color={p.att>=90?'var(--c-green-400)':p.att>=70?'var(--product-accent)':'var(--c-red-400)'} className="flex-1"/>
                      <span className="text-[11px] text-[var(--c-ink-3)] w-8 text-right">{p.att}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 min-w-[120px]">
                    <div className="flex items-center gap-2">
                      <ProgressBar value={p.avg} color={p.avg>=70?'var(--c-green-400)':p.avg>=50?'var(--product-accent)':'var(--c-red-400)'} className="flex-1"/>
                      <span className="text-[11px] text-[var(--c-ink-3)] w-8 text-right">{p.avg}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <Chip variant={p.status==='active'?'green':'amber'}>{p.status==='active'?'Active':'At risk'}</Chip>
                  </td>
                  <td className="px-5 py-3">
                    <Button variant="ghost" size="sm" icon="eye">Profile</Button>
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

export function TeacherLessons() {
  const lessons = [
    { week:'Week 9', subject:'Mathematics',      topic:'Multiplication of 2-digit numbers', done:true },
    { week:'Week 9', subject:'English Language',  topic:'Reading comprehension — My Family',  done:true },
    { week:'Week 9', subject:'Basic Science',     topic:'Plants and Their Parts',             done:false,current:true },
    { week:'Week 9', subject:'Social Studies',    topic:'Our Community Helpers',              done:false },
    { week:'Week 10',subject:'Mathematics',      topic:'Division — Sharing equally',         done:false },
  ];
  return (
    <div>
      <PageHeader eyebrow="Teacher" title="Lessons" subtitle="NERDC-aligned lessons for your class.">
        <Button variant="ghost" icon="download">Download scheme</Button>
      </PageHeader>
      <div className="space-y-3">
        {lessons.map((l,i) => (
          <div key={i} className="flex items-center gap-4 p-4 bg-[var(--c-surface-2)] border border-[var(--c-line-2)] rounded-xl hover:border-[var(--product-accent)] transition-colors cursor-pointer">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: l.done?'rgba(63,185,80,0.15)':l.current?'rgba(34,184,166,0.15)':'var(--c-surface-4)',
                       color: l.done?'var(--c-green-400)':l.current?'var(--c-teal-400)':'var(--c-ink-4)' }}>
              <Icon name={l.done?'check':l.current?'player-play':'book'} className="text-[18px]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-[var(--c-ink-0)]">{l.topic}</div>
              <div className="text-[11px] text-[var(--c-ink-3)] mt-0.5">{l.subject} · {l.week}</div>
            </div>
            {l.done    && <Chip variant="green">Done</Chip>}
            {l.current && <Chip variant="teal">Current</Chip>}
            {!l.done && !l.current && <Chip variant="default">Upcoming</Chip>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function TeacherInterventions() {
  return (
    <div>
      <PageHeader eyebrow="Teacher" title="Interventions" subtitle="Students flagged for extra support.">
        <Button variant="primary" icon="plus">Log concern</Button>
      </PageHeader>
      <div className="space-y-3">
        {[
          { name:'Amara Okafor', issue:'Attendance — 4 consecutive absences', severity:'high',   action:'Contact parent'       },
          { name:'Kemi Adeyemi', issue:'Academic — below 50% in Maths (3x)',   severity:'medium', action:'Revision plan needed' },
        ].map((r,i) => (
          <div key={i} className="p-4 bg-[var(--c-surface-2)] border rounded-xl"
            style={{ borderColor: r.severity==='high'?'rgba(239,83,80,0.3)':'rgba(245,165,36,0.3)' }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-semibold text-[var(--c-ink-0)]">{r.name}</div>
                <div className="text-[12px] text-[var(--c-ink-3)] mt-1">{r.issue}</div>
                <div className="text-[11px] mt-2 font-medium" style={{ color: r.severity==='high'?'var(--c-red-400)':'var(--c-amber-400)' }}>
                  Recommended: {r.action}
                </div>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <Chip variant={r.severity==='high'?'red':'amber'}>{r.severity}</Chip>
                <Button variant="ghost" size="sm" icon="message-dots">Message parent</Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TeacherComms() {
  return (
    <div>
      <PageHeader eyebrow="Teacher" title="Communications" subtitle="Messages and announcements.">
        <Button variant="primary" icon="plus">New message</Button>
      </PageHeader>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KpiCard label="Unread"     value="2"  deltaDir="flat" icon="message-dots"   />
        <KpiCard label="Sent today" value="5"  deltaDir="up"   icon="send"           />
        <KpiCard label="Parent msgs"value="8"  deltaDir="up"   icon="messages"       />
        <KpiCard label="WA opt-ins" value="18" deltaDir="up"   icon="brand-whatsapp" />
      </div>
      <Card>
        <Empty icon="message-dots" message="Your message inbox will appear here." action={<Button variant="primary" icon="plus">New message</Button>}/>
      </Card>
    </div>
  );
}

export function TeacherReports() {
  return (
    <div>
      <PageHeader eyebrow="Teacher" title="Reports" subtitle="Class performance and term summaries.">
        <Button variant="ghost" icon="download">Export report</Button>
      </PageHeader>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KpiCard label="Class avg"       value="74%"  deltaDir="up"   icon="chart-bar"    />
        <KpiCard label="Pass rate"       value="88%"  deltaDir="up"   icon="circle-check" />
        <KpiCard label="Lessons covered" value="9/13" deltaDir="up"   icon="book-2"       />
        <KpiCard label="Assessments done"value="6"    deltaDir="up"   icon="clipboard"    />
      </div>
      <Card>
        <Empty icon="file-analytics" message="Full class performance report will appear here." action={<Button variant="ghost" icon="download">Generate report</Button>}/>
      </Card>
    </div>
  );
}
