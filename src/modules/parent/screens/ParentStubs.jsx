import { PageHeader, Card, CardHeader, KpiCard, Chip, Button, Empty, StatRow, Divider } from '@/components/ui';

export function ParentChild() {
  return (
    <div>
      <PageHeader eyebrow="Parent" title="My child" subtitle="Chidi Obi · Primary 2A · TLF Lekki Academy" />
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Child details" />
          <StatRow label="Full name"       value="Chidi Emeka Obi"         />
          <StatRow label="Class"           value="Primary 2A"              />
          <StatRow label="School"          value="TLF Lekki Academy"       />
          <StatRow label="Admission no."   value="TLF/2023/002"            />
          <StatRow label="Gender"          value="Male"                    />
          <StatRow label="Date of birth"   value="12 March 2018"           />
          <StatRow label="Blood group"     value="O+"                      />
        </Card>
        <Card>
          <CardHeader title="Class teacher" />
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-[rgba(229,166,42,0.2)] flex items-center justify-center text-[var(--c-gold-400)] font-bold shrink-0">JA</div>
            <div>
              <div className="font-semibold text-[var(--c-ink-0)]">Mrs Janet Adeyemi</div>
              <div className="text-[11px] text-[var(--c-ink-3)]">Class Teacher · Primary 2A</div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" icon="message-dots">Message</Button>
            <Button variant="ghost" size="sm" icon="brand-whatsapp">WhatsApp</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

export function ParentComms() {
  const msgs = [
    { from:'Mrs Adeyemi', text:'Chidi did very well in today\'s science class!', time:'10:24 AM', unread:true  },
    { from:'Admin',       text:'Term 3 report cards are ready for download.',     time:'Yesterday',unread:false },
    { from:'Mrs Adeyemi', text:'Please ensure Chidi brings his workbook tomorrow.',time:'Mon',     unread:false },
  ];
  return (
    <div>
      <PageHeader eyebrow="Parent" title="Messages" subtitle="Communicate with your child's school.">
        <Button variant="primary" icon="plus">New message</Button>
      </PageHeader>
      <Card padding={false}>
        {msgs.map((m,i) => (
          <div key={i} className="flex items-start gap-3 p-4 border-b border-[var(--c-line-1)] last:border-0 hover:bg-[var(--c-surface-3)] transition-colors cursor-pointer">
            {m.unread && <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background:'var(--product-accent)' }} />}
            {!m.unread && <div className="w-2 shrink-0" />}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold text-[var(--c-ink-0)]">{m.from}</span>
                <span className="text-[11px] text-[var(--c-ink-4)] font-mono">{m.time}</span>
              </div>
              <div className="text-[12px] text-[var(--c-ink-3)] mt-0.5 line-clamp-2">{m.text}</div>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

export function ParentCalendar() {
  const events = [
    { date:'Mon 16 Jun', event:'PTA Meeting',           time:'4:00 PM',  type:'meeting' },
    { date:'Wed 18 Jun', event:'End of Term Assessment', time:'All day',  type:'exam'    },
    { date:'Fri 20 Jun', event:'School Cultural Day',    time:'9:00 AM',  type:'event'   },
    { date:'Mon 30 Jun', event:'Term 3 ends',            time:'All day',  type:'holiday' },
  ];
  const colors = { meeting:'#3b82f6', exam:'#f97066', event:'#22b8a6', holiday:'#e5a62a' };
  return (
    <div>
      <PageHeader eyebrow="Parent" title="School calendar" subtitle="Upcoming events, assessments, and holidays." />
      <Card>
        <CardHeader title="Upcoming events" />
        <div className="space-y-3">
          {events.map((e,i) => (
            <div key={i} className="flex gap-4 p-3 rounded-xl hover:bg-[var(--c-surface-3)] transition-colors"
              style={{ borderLeft:`3px solid ${colors[e.type]}` }}>
              <div className="shrink-0 text-center">
                <div className="text-[10px] font-mono uppercase tracking-wide text-[var(--c-ink-4)]">{e.date.split(' ')[0]}</div>
                <div className="text-[18px] font-bold text-[var(--c-ink-0)]">{e.date.split(' ')[1]}</div>
              </div>
              <div className="flex-1">
                <div className="text-[13px] font-semibold text-[var(--c-ink-0)]">{e.event}</div>
                <div className="text-[11px] text-[var(--c-ink-3)] mt-0.5">{e.time}</div>
              </div>
              <Chip variant={e.type==='exam'?'coral':e.type==='meeting'?'sky':e.type==='holiday'?'gold':'teal'} size="sm">
                {e.type}
              </Chip>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export function ParentBilling() {
  return (
    <div>
      <PageHeader eyebrow="Parent" title="Billing" subtitle="School fees and payment history." />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Term 3 fees"    value="₦45,000" deltaDir="flat"                 icon="receipt-2"   />
        <KpiCard label="Amount paid"    value="₦45,000" deltaDir="up"   delta="Paid in full" icon="check"  />
        <KpiCard label="Outstanding"    value="₦0"      deltaDir="flat"                 icon="circle-check"/>
        <KpiCard label="Next due"       value="Aug 2026" deltaDir="flat"                icon="calendar"    />
      </div>
      <Card>
        <CardHeader title="Payment history" />
        {[
          { date:'01 Sep 2025', desc:'Term 3 school fees', amount:'₦45,000', status:'paid' },
          { date:'01 May 2025', desc:'Term 2 school fees', amount:'₦45,000', status:'paid' },
          { date:'10 Jan 2025', desc:'Term 1 school fees', amount:'₦42,000', status:'paid' },
        ].map((p,i) => (
          <div key={i} className="flex items-center gap-3 py-3 border-b border-[var(--c-line-1)] last:border-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[rgba(63,185,80,0.1)]">
              <i className="ti ti-receipt text-[var(--c-green-400)]" aria-hidden="true"/>
            </div>
            <div className="flex-1">
              <div className="text-[13px] font-medium text-[var(--c-ink-1)]">{p.desc}</div>
              <div className="text-[11px] text-[var(--c-ink-3)] mt-0.5 font-mono">{p.date}</div>
            </div>
            <div className="text-right">
              <div className="text-[13px] font-bold text-[var(--c-ink-0)]">{p.amount}</div>
              <Chip variant="green" size="sm">{p.status}</Chip>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

export function ParentWhatsApp() {
  return (
    <div>
      <PageHeader eyebrow="Parent" title="WhatsApp integration" subtitle="Receive school updates directly on WhatsApp." />
      <Card>
        <CardHeader title="WhatsApp opt-in" />
        <div className="text-center py-8">
          <div className="text-[56px] mb-4">📱</div>
          <div className="text-[16px] font-semibold text-[var(--c-ink-0)] mb-2">Stay connected via WhatsApp</div>
          <div className="text-[13px] text-[var(--c-ink-3)] mb-6 max-w-[320px] mx-auto">
            Get real-time updates about your child's attendance, lessons, and school announcements on WhatsApp.
          </div>
          <Button variant="primary" icon="brand-whatsapp">Connect WhatsApp</Button>
        </div>
        <Divider className="my-4" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon:'calendar-stats', label:'Attendance alerts', desc:'Notified if your child is marked absent.' },
            { icon:'book-2',          label:'Lesson reminders',  desc:'Daily reminder for tonight\'s lesson.'    },
            { icon:'bell',            label:'School notices',    desc:'Important school announcements.'         },
          ].map(f => (
            <div key={f.label} className="p-4 bg-[var(--c-surface-3)] rounded-xl">
              <i className={`ti ti-${f.icon} text-[24px] accent-text mb-2 block`} aria-hidden="true"/>
              <div className="text-[13px] font-semibold text-[var(--c-ink-0)]">{f.label}</div>
              <div className="text-[11px] text-[var(--c-ink-3)] mt-1">{f.desc}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export function ParentTutors() {
  const tutors = [
    { name:'Mr Emeka Okafor',  subjects:['Mathematics','Basic Science'], rating:4.9, rate:'₦5,000/hr', location:'Victoria Island', verified:true  },
    { name:'Mrs Chioma Eze',   subjects:['English Language'],            rating:4.7, rate:'₦4,500/hr', location:'Lekki Phase 1',  verified:true  },
    { name:'Dr Bola Adeyemi',  subjects:['Mathematics','Physics'],       rating:5.0, rate:'₦7,000/hr', location:'Ikeja',          verified:true  },
    { name:'Miss Ngozi Bello', subjects:['English Language','French'],   rating:4.6, rate:'₦4,000/hr', location:'Yaba',           verified:false },
  ];
  return (
    <div>
      <PageHeader eyebrow="Parent" title="Find a tutor" subtitle="Browse verified tutors on the TTA marketplace.">
        <Button variant="primary" icon="plus">Post a request</Button>
      </PageHeader>
      <div className="grid sm:grid-cols-2 gap-4">
        {tutors.map((t,i) => (
          <Card key={i}>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-[15px] shrink-0"
                style={{ background:'rgba(16,185,129,0.2)', color:'var(--c-emerald-400)' }}>
                {t.name.split(' ').map(n=>n[0]).join('').slice(0,2)}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-[var(--c-ink-0)]">{t.name}</div>
                <div className="text-[11px] text-[var(--c-ink-3)] mt-0.5">📍 {t.location}</div>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-[11px] text-[var(--c-amber-400)]">{'★'.repeat(Math.floor(t.rating))}</span>
                  <span className="text-[11px] text-[var(--c-ink-3)]">{t.rating}</span>
                  {t.verified && <Chip variant="emerald" size="sm">✓ Verified</Chip>}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-bold text-[var(--c-ink-0)] text-[13px]">{t.rate}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-1 mb-4">
              {t.subjects.map(s => <Chip key={s} variant="default" size="sm">{s}</Chip>)}
            </div>
            <Button variant="ghost" size="sm" icon="calendar-plus" className="w-full justify-center">Request session</Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
