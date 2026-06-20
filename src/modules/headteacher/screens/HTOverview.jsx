/**
 * HTOverview.jsx — Head Teacher dashboard
 * Teacher performance snapshot · At-risk students · Attendance · Alerts
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import {
  PageHeader, Card, CardHeader, KpiCard, Chip, Button,
  Avatar, ProgressBar, LoadingScreen, Alert,
} from '@/components/ui';

function greetHour() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function useHTSummary(schoolId) {
  return useQuery({
    queryKey: ['ht-summary', schoolId],
    queryFn: async () => {
      const [teachersRes, pupilsRes, intRes, attRes] = await Promise.all([
        supabase.from('profiles').select('id,first_name,last_name,classes(id,name,pupils(id))').eq('school_id', schoolId).in('role', ['teacher']),
        supabase.from('pupils').select('id,status').eq('school_id', schoolId),
        supabase.from('interventions').select('id,severity').eq('school_id', schoolId).eq('resolved', false),
        supabase.from('attendance_records').select('status').eq('school_id', schoolId)
          .gte('created_at', new Date(Date.now() - 7 * 864e5).toISOString()),
      ]);

      const att      = attRes.data ?? [];
      const present  = att.filter(r => r.status === 'present').length;
      const attPct   = att.length ? Math.round((present / att.length) * 100) : 0;

      return {
        teachers:      teachersRes.data ?? [],
        pupils:        pupilsRes.data ?? [],
        interventions: intRes.data ?? [],
        attPct,
      };
    },
    enabled: !!schoolId,
    staleTime: 60_000,
  });
}

const MOCK_TEACHER_PERF = [
  { name:'Mrs Janet Adeyemi', class:'Primary 2A', lessonsThisWeek:5, attendance:96, assessmentsDue:0,  colour:'#22b8a6' },
  { name:'Mr Tunde Okonkwo',  class:'Primary 2B', lessonsThisWeek:4, attendance:88, assessmentsDue:2,  colour:'#e5a62a' },
  { name:'Ms Amina Ibrahim',  class:'Primary 3A', lessonsThisWeek:5, attendance:92, assessmentsDue:0,  colour:'#22b8a6' },
  { name:'Mrs Rose Chukwu',   class:'Nursery 2',  lessonsThisWeek:3, attendance:94, assessmentsDue:1,  colour:'#e5a62a' },
];

const MOCK_RISK = [
  { name:'Amara Okafor',  class:'Primary 2A', issue:'4 consecutive absences',         severity:'high'   },
  { name:'Kemi Adeyemi',  class:'Primary 3A', issue:'Below 50% in 3 subjects',        severity:'high'   },
  { name:'Bola Johnson',  class:'Primary 2B', issue:'Lesson completion dropped to 40%',severity:'medium' },
  { name:'Ngozi Eze',     class:'Nursery 2',  issue:'Late arrival pattern (5 days)',   severity:'medium' },
];

export default function HTOverview() {
  const { profile, schoolId } = useAuth();
  const { data, isLoading }   = useHTSummary(schoolId);

  if (isLoading) return <LoadingScreen />;

  const highRisk = data?.interventions?.filter(i => ['high','critical'].includes(i.severity)).length ?? 0;

  return (
    <div>
      <PageHeader
        eyebrow="Head Teacher"
        title={`${greetHour()}, ${profile?.first_name ?? 'Head Teacher'}`}
        subtitle="Here's your school overview for today."
      >
        <Button variant="primary" icon="plus">Log concern</Button>
        <Button variant="ghost"   icon="download">Export report</Button>
      </PageHeader>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Teachers"          value={data?.teachers?.length ?? '—'}                          deltaDir="flat" icon="id-badge-2"    />
        <KpiCard label="Total students"    value={data?.pupils?.length ?? '—'}                            deltaDir="flat" icon="users"         />
        <KpiCard label="Weekly attendance" value={data?.attPct ? `${data.attPct}%` : '—'}                deltaDir={data?.attPct >= 90 ? 'up' : 'down'} delta="This week" icon="calendar-stats" />
        <KpiCard label="Open interventions" value={data?.interventions?.length ?? '—'}                   deltaDir={highRisk > 0 ? 'down' : 'flat'} delta={highRisk > 0 ? `${highRisk} high risk` : 'All clear'} icon="alert-triangle" />
      </div>

      {/* High-risk alert */}
      {highRisk > 0 && (
        <Alert type="error" className="mb-5">
          {highRisk} high-risk intervention{highRisk !== 1 ? 's' : ''} require{highRisk === 1 ? 's' : ''} your immediate attention.
          <Button variant="link" className="ml-3 text-[var(--c-red-400)]" size="sm">View all →</Button>
        </Alert>
      )}

      <div className="grid lg:grid-cols-2 gap-4 mb-4">

        {/* Teacher performance */}
        <Card>
          <CardHeader title="Teacher performance — this week" action="Full report" />
          <div className="space-y-1">
            {MOCK_TEACHER_PERF.map((t, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-[var(--c-surface-3)] transition-colors">
                <Avatar name={t.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-[var(--c-ink-1)] truncate">{t.name}</div>
                  <div className="text-[11px] text-[var(--c-ink-3)]">{t.class} · {t.lessonsThisWeek}/5 lessons delivered</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[12px] font-semibold" style={{ color: t.colour }}>{t.attendance}% att.</div>
                  {t.assessmentsDue > 0 && (
                    <Chip variant="amber" size="sm">{t.assessmentsDue} pending</Chip>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* At-risk students */}
        <Card>
          <CardHeader title="Students requiring attention" action="All interventions" />
          <div className="space-y-2">
            {MOCK_RISK.map((s, i) => (
              <div key={i}
                className="flex gap-3 p-3 rounded-lg"
                style={{
                  background: s.severity === 'high' ? 'rgba(239,83,80,0.07)' : 'rgba(245,165,36,0.07)',
                  borderLeft: `3px solid ${s.severity === 'high' ? 'var(--c-red-400)' : 'var(--c-amber-400)'}`,
                }}
              >
                <Avatar name={s.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-[var(--c-ink-0)]">{s.name}</div>
                  <div className="text-[11px] text-[var(--c-ink-3)] mt-0.5">{s.class} · {s.issue}</div>
                </div>
                <Chip variant={s.severity === 'high' ? 'red' : 'amber'} size="sm">{s.severity}</Chip>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Attendance by class */}
      <Card>
        <CardHeader title="Attendance by class — this week" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { class:'Primary 2A', pct:96, teacher:'Mrs Adeyemi' },
            { class:'Primary 2B', pct:88, teacher:'Mr Okonkwo'  },
            { class:'Primary 3A', pct:92, teacher:'Ms Ibrahim'  },
            { class:'Nursery 2',  pct:94, teacher:'Mrs Chukwu'  },
          ].map(c => (
            <div key={c.class} className="bg-[var(--c-surface-3)] rounded-xl p-4">
              <div className="font-heading font-bold text-[15px] text-[var(--c-ink-0)] mb-0.5">{c.class}</div>
              <div className="text-[11px] text-[var(--c-ink-3)] mb-3">{c.teacher}</div>
              <div className="font-heading text-[28px] font-bold mb-1"
                style={{ color: c.pct >= 90 ? 'var(--c-green-400)' : 'var(--product-accent)' }}>
                {c.pct}%
              </div>
              <ProgressBar value={c.pct} color={c.pct >= 90 ? 'var(--c-green-400)' : 'var(--product-accent)'} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
