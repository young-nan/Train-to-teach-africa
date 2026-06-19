/**
 * AdminStubs.jsx — Remaining lightweight stubs
 * AdminCalendar · AdminFinance · AdminImpact · AdminAuditLog
 * (All other screens now have full implementations)
 */

import { PageHeader, Card, CardHeader, KpiCard, Chip, Button, Empty } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';

export function AdminCalendar() {
  const events = [
    { date:'Mon 16 Jun', event:'PTA Meeting',            time:'4:00 PM',  type:'meeting' },
    { date:'Wed 18 Jun', event:'End of Term Assessment',  time:'All day',  type:'exam'   },
    { date:'Fri 20 Jun', event:'School Cultural Day',     time:'9:00 AM',  type:'event'  },
    { date:'Mon 30 Jun', event:'Term 3 ends',             time:'All day',  type:'holiday'},
  ];
  const colors = { meeting:'#3b82f6', exam:'#f97066', event:'#22b8a6', holiday:'#e5a62a' };
  return (
    <div>
      <PageHeader eyebrow="Admin" title="Calendar" subtitle="School events, assessments, and term dates.">
        <Button variant="primary" icon="plus">Add event</Button>
      </PageHeader>
      <Card>
        <CardHeader title="Upcoming events" />
        <div className="space-y-3">
          {events.map((e,i) => (
            <div key={i} className="flex gap-4 p-3 rounded-xl hover:bg-[var(--c-surface-3)] transition-colors"
              style={{ borderLeft:`3px solid ${colors[e.type]}` }}>
              <div className="shrink-0 text-center w-12">
                <div className="text-[10px] font-mono uppercase tracking-wide text-[var(--c-ink-4)]">{e.date.split(' ')[0]}</div>
                <div className="text-[18px] font-bold text-[var(--c-ink-0)]">{e.date.split(' ')[1]}</div>
              </div>
              <div className="flex-1">
                <div className="text-[13px] font-semibold text-[var(--c-ink-0)]">{e.event}</div>
                <div className="text-[11px] text-[var(--c-ink-3)] mt-0.5">{e.time}</div>
              </div>
              <Chip variant={e.type==='exam'?'coral':e.type==='meeting'?'sky':e.type==='holiday'?'gold':'teal'} size="sm">{e.type}</Chip>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export function AdminFinance() {
  const payments = [
    { name:'Chidi Obi',    class:'Primary 2A', amount:'₦45,000', status:'paid',    date:'01 Sep 2025' },
    { name:'Amara Okafor', class:'Primary 2A', amount:'₦45,000', status:'pending', date:'—'            },
    { name:'Fatima Bello', class:'Primary 2B', amount:'₦45,000', status:'paid',    date:'04 Sep 2025' },
    { name:'Kemi Adeyemi', class:'Primary 3A', amount:'₦45,000', status:'overdue', date:'—'            },
  ];
  const statusVariant = { paid:'green', pending:'amber', overdue:'red' };
  return (
    <div>
      <PageHeader eyebrow="Admin" title="Finance" subtitle="Fee tracking, invoices, and payment records.">
        <Button variant="ghost" icon="download">Export report</Button>
      </PageHeader>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Total collected" value="₦3.2M"  deltaDir="up"   delta="+12% vs last term" icon="receipt-2"    />
        <KpiCard label="Outstanding"     value="₦840K"  deltaDir="down" delta="47 invoices"        icon="alert-circle" />
        <KpiCard label="Collection rate" value="79%"    deltaDir="up"   delta="+5%"                icon="trending-up"  />
        <KpiCard label="Scholarships"    value="6"      deltaDir="flat"                             icon="award"        />
      </div>
      <Card padding={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[var(--c-line-2)]">
                {['Student','Class','Amount','Status','Date paid'].map(h=>(
                  <th key={h} className="text-left px-5 py-3 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--c-ink-3)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payments.map((p,i)=>(
                <tr key={i} className="border-b border-[var(--c-line-1)] last:border-0 hover:bg-[var(--c-surface-3)] transition-colors">
                  <td className="px-5 py-3 font-semibold text-[var(--c-ink-0)]">{p.name}</td>
                  <td className="px-5 py-3 text-[var(--c-ink-2)]">{p.class}</td>
                  <td className="px-5 py-3 font-mono font-semibold text-[var(--c-ink-0)]">{p.amount}</td>
                  <td className="px-5 py-3"><Chip variant={statusVariant[p.status]} size="sm">{p.status}</Chip></td>
                  <td className="px-5 py-3 font-mono text-[11px] text-[var(--c-ink-3)]">{p.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export function AdminImpact() {
  return (
    <div>
      <PageHeader eyebrow="Admin" title="Impact Hub" subtitle="Attendance trends, literacy, and learning outcomes.">
        <Button variant="ghost" icon="download">Download report</Button>
      </PageHeader>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Attendance growth"  value="+6%"  deltaDir="up" delta="vs last term" icon="trending-up"   />
        <KpiCard label="Lesson completion"  value="71%"  deltaDir="up" delta="+8%"          icon="book-2"        />
        <KpiCard label="Parent engagement"  value="68%"  deltaDir="up" delta="+12%"         icon="users"         />
        <KpiCard label="Teacher activity"   value="94%"  deltaDir="up" delta="On track"     icon="chalkboard"    />
      </div>
      <Card>
        <Empty icon="trophy" message="Detailed impact charts and donor-ready reports coming soon." action={<Button variant="ghost" icon="download">Download current report</Button>}/>
      </Card>
    </div>
  );
}

export function AdminAuditLog() {
  const entries = [
    { action:'Attendance marked',      user:'Mrs Adeyemi', time:'08:35 today',  type:'info'    },
    { action:'Student profile updated', user:'Admin',       time:'08:12 today',  type:'info'    },
    { action:'Student added',           user:'Admin',       time:'07:52 today',  type:'success' },
    { action:'Grade updated',           user:'Mr Okonkwo',  time:'Yesterday',    type:'info'    },
    { action:'Class created',           user:'Admin',       time:'2 days ago',   type:'success' },
    { action:'Settings changed',        user:'Admin',       time:'3 days ago',   type:'warning' },
    { action:'Staff invited',           user:'Admin',       time:'5 days ago',   type:'success' },
  ];
  const colors = { info:'teal', success:'green', warning:'amber', error:'red' };
  const icons  = { info:'info-circle', success:'circle-check', warning:'alert-triangle', error:'alert-circle' };

  return (
    <div>
      <PageHeader eyebrow="Admin" title="Audit log" subtitle="Every system action tracked and timestamped.">
        <Button variant="ghost" icon="download">Export log</Button>
      </PageHeader>
      <Card padding={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[var(--c-line-2)]">
                {['Action','Performed by','Time','Type'].map(h=>(
                  <th key={h} className="text-left px-5 py-3 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--c-ink-3)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((e,i)=>(
                <tr key={i} className="border-b border-[var(--c-line-1)] last:border-0 hover:bg-[var(--c-surface-3)] transition-colors">
                  <td className="px-5 py-3 font-medium text-[var(--c-ink-0)]">{e.action}</td>
                  <td className="px-5 py-3 text-[var(--c-ink-2)]">{e.user}</td>
                  <td className="px-5 py-3 font-mono text-[11px] text-[var(--c-ink-3)]">{e.time}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <Icon name={icons[e.type]} className="text-[14px]" style={{ color:`var(--c-${e.type}-400, var(--c-teal-400))` }} />
                      <Chip variant={colors[e.type]} size="sm">{e.type}</Chip>
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
