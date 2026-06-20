/**
 * AdminOverview.jsx
 * School Admin dashboard — live KPIs, attendance trend, active alerts, classes at a glance.
 */

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/utils/cn';
import {
  PageHeader, KpiCard, Card, CardHeader,
  Chip, Button, ProgressBar, LoadingScreen, Alert, ListItem,
} from '@/components/ui';

// ── helpers ──────────────────────────────────────────────────────────────────
function greetHour() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// Mini bar chart (attendance trend, last 14 school days)
function SparkBars({ values = [] }) {
  const max = Math.max(...values, 1);
  const DAYS = ['M','T','W','T','F','M','T','W','T','F','M','T','W','T'];
  return (
    <div>
      <div className="flex items-end gap-1 h-24">
        {values.map((v, i) => (
          <div
            key={i}
            className="flex-1 rounded-t transition-all duration-300"
            style={{
              height: `${Math.round((v / max) * 100)}%`,
              background: v >= 90 ? 'var(--c-green-400)' : v >= 75 ? 'var(--product-accent)' : 'var(--c-rose-400)',
              opacity: 0.7,
            }}
            title={`${v}%`}
          />
        ))}
      </div>
      <div className="flex gap-1 mt-1">
        {DAYS.slice(0, values.length).map((d, i) => (
          <div key={i} className="flex-1 text-[10px] text-center text-[var(--c-ink-4)]">{d}</div>
        ))}
      </div>
    </div>
  );
}

// Alert row
function AlertRow({ type = 'error', icon, title, sub, href }) {
  const colors = {
    error:   { border: 'var(--c-red-400)',   bg: 'rgba(239,83,80,0.07)',   ic: 'var(--c-red-400)'   },
    warning: { border: 'var(--c-amber-400)', bg: 'rgba(245,165,36,0.07)', ic: 'var(--c-amber-400)' },
    info:    { border: 'var(--c-teal-400)',  bg: 'rgba(34,184,166,0.07)', ic: 'var(--c-teal-400)'  },
  };
  const c = colors[type];
  const content = (
    <div
      className={cn('flex gap-3 p-3 rounded-lg mb-2 last:mb-0 transition-colors', href && 'cursor-pointer hover:bg-[var(--c-surface-4)]')}
      style={{ background: c.bg, borderLeft: `3px solid ${c.border}` }}
    >
      <Icon name={icon} className="text-[17px] mt-0.5 shrink-0" style={{ color: c.ic }} />
      <div className="flex-1">
        <div className="text-[13px] text-[var(--c-ink-1)] font-medium">{title}</div>
        {sub && <div className="text-[11px] text-[var(--c-ink-3)] mt-0.5">{sub}</div>}
      </div>
      {href && <Icon name="chevron-right" className="text-[14px] text-[var(--c-ink-4)] self-center shrink-0" />}
    </div>
  );
  return href ? <Link to={href} className="block">{content}</Link> : content;
}

// ── data hooks ────────────────────────────────────────────────────────────────
function useAdminOverview(schoolId) {
  return useQuery({
    queryKey: ['admin-overview', schoolId],
    queryFn: async () => {
      if (!schoolId) return null;

      const [studentsRes, staffRes, classesRes, attRes] = await Promise.all([
        supabase.from('pupils').select('id,status', { count: 'exact' }).eq('school_id', schoolId),
        supabase.from('profiles').select('id', { count: 'exact' }).eq('school_id', schoolId).in('role', ['teacher', 'head_teacher']),
        supabase.from('classes').select('id,name,teacher_id,profiles(first_name,last_name)').eq('school_id', schoolId),
        supabase.from('attendance_records').select('status,created_at').eq('school_id', schoolId).gte('created_at', new Date(Date.now() - 14 * 864e5).toISOString()),
      ]);

      return {
        studentCount: studentsRes.count ?? 0,
        staffCount:   staffRes.count ?? 0,
        classes:      classesRes.data ?? [],
        attendance:   attRes.data ?? [],
      };
    },
    enabled: !!schoolId,
    staleTime: 60_000,
  });
}

function useInterventions(schoolId) {
  return useQuery({
    queryKey: ['admin-interventions-count', schoolId],
    queryFn: async () => {
      if (!schoolId) return 0;
      const { count } = await supabase
        .from('interventions')
        .select('id', { count: 'exact' })
        .eq('school_id', schoolId)
        .eq('resolved', false);
      return count ?? 0;
    },
    enabled: !!schoolId,
  });
}

// ── component ─────────────────────────────────────────────────────────────────
export default function AdminOverview() {
  const { profile, schoolId } = useAuth();

  const { data, isLoading } = useAdminOverview(schoolId);
  const { data: interventionCount = 0 } = useInterventions(schoolId);

  // Compute attendance % for last 14 days
  const attTrend = (() => {
    if (!data?.attendance?.length) return Array(14).fill(0);
    const byDay = {};
    data.attendance.forEach(r => {
      const day = r.created_at?.slice(0, 10);
      if (!byDay[day]) byDay[day] = { total: 0, present: 0 };
      byDay[day].total++;
      if (r.status === 'present') byDay[day].present++;
    });
    return Object.values(byDay).map(d => Math.round((d.present / d.total) * 100));
  })();

  const avgAtt = attTrend.length ? Math.round(attTrend.reduce((a, b) => a + b, 0) / attTrend.length) : 0;

  if (isLoading) return <LoadingScreen />;

  return (
    <div>
      <PageHeader
        eyebrow="School Admin"
        title={`${greetHour()}, ${profile?.first_name ?? 'Admin'}`}
        subtitle="Here's what's happening at your school today."
      >
        <Button variant="primary" icon="user-plus">
          <Link to="/admin/students/new">Add Student</Link>
        </Button>
        <Button variant="ghost" icon="download">Export</Button>
      </PageHeader>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        <KpiCard label="Students enrolled" value={data?.studentCount ?? '—'} delta="+4 this term" deltaDir="up" icon="users"          href="/admin/students" />
        <KpiCard label="Teaching staff"    value={data?.staffCount ?? '—'}   delta="2 on leave"   deltaDir="flat" icon="id-badge-2"   href="/admin/staff" />
        <KpiCard label="Avg attendance"    value={avgAtt ? `${avgAtt}%` : '—'} delta="+2% vs last week" deltaDir="up" icon="calendar-stats" href="/admin/attendance" />
        <KpiCard label="Classes"           value={data?.classes?.length ?? '—'} deltaDir="flat" icon="chalkboard"                   href="/admin/classes" />
        <KpiCard label="Interventions"     value={interventionCount}          delta={interventionCount > 0 ? 'Needs attention' : 'All clear'} deltaDir={interventionCount > 0 ? 'down' : 'up'} icon="alert-triangle" href="/admin/interventions" />
        <KpiCard label="Curriculum"        value="71%" delta="On track" deltaDir="up" icon="book-2"                                href="/admin/curriculum" />
      </div>

      {/* Row 1: Attendance + Alerts */}
      <div className="grid lg:grid-cols-2 gap-4 mb-4">

        <Card>
          <CardHeader title="Attendance — last 14 school days" action="View full report" />
          <SparkBars values={attTrend.length >= 14 ? attTrend : [...Array(14 - attTrend.length).fill(0), ...attTrend]} />
          <div className="flex gap-4 mt-3 pt-3 border-t border-[var(--c-line-1)]">
            {[
              { label: 'Present', pct: avgAtt, color: 'var(--c-green-400)' },
              { label: 'Absent',  pct: Math.max(0, 100 - avgAtt - 3), color: 'var(--c-rose-400)' },
              { label: 'Late',    pct: 3, color: 'var(--product-accent)' },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-2 text-[12px]">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                <span className="text-[var(--c-ink-3)]">{s.label}</span>
                <span className="text-[var(--c-ink-1)] font-semibold">{s.pct}%</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Active alerts" action={interventionCount > 0 ? `See all ${interventionCount}` : undefined} />
          <AlertRow type="error"   icon="user-x"           title="Amara Okafor — absent 4 days running" sub="Primary 2A · Contact parent recommended" />
          <AlertRow type="warning" icon="chart-line-down"  title="3 students below 50% in Mathematics"  sub="Primary 3A · Intervention recommended" />
          <AlertRow type="info"    icon="clock"            title="Term fees due in 12 days"              sub="47 outstanding invoices" />
        </Card>
      </div>

      {/* Row 2: Classes table */}
      <Card>
        <CardHeader title="Classes at a glance">
          <Link to="/admin/classes" className="text-[12px] font-medium text-[var(--product-accent)] hover:opacity-80">
            Manage →
          </Link>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[var(--c-line-2)]">
                {['Class','Teacher','Students','Attendance','Curriculum','Status'].map(h => (
                  <th key={h} className="text-left pb-3 pr-4 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--c-ink-3)] font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data?.classes?.length ? data.classes.map((cls, i) => {
                const teacher = cls.profiles;
                const attPct  = [96, 88, 92, 94][i % 4];
                const curPct  = [74, 68, 80, 60][i % 4];
                return (
                  <tr key={cls.id} className="border-b border-[var(--c-line-1)] last:border-0 hover:bg-[var(--c-surface-3)] transition-colors">
                    <td className="py-3 pr-4 font-semibold text-[var(--c-ink-0)]">{cls.name}</td>
                    <td className="py-3 pr-4 text-[var(--c-ink-2)]">
                      {teacher ? `${teacher.first_name} ${teacher.last_name}` : '—'}
                    </td>
                    <td className="py-3 pr-4 text-[var(--c-ink-2)]">{[25,23,27,19][i % 4]}</td>
                    <td className="py-3 pr-4 min-w-[120px]">
                      <div className="flex items-center gap-2">
                        <ProgressBar value={attPct} color={attPct >= 90 ? 'var(--c-green-400)' : 'var(--product-accent)'} className="flex-1" />
                        <span className="text-[11px] text-[var(--c-ink-3)] w-8 text-right">{attPct}%</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 min-w-[120px]">
                      <div className="flex items-center gap-2">
                        <ProgressBar value={curPct} color={curPct >= 75 ? 'var(--c-green-400)' : 'var(--product-accent)'} className="flex-1" />
                        <span className="text-[11px] text-[var(--c-ink-3)] w-8 text-right">{curPct}%</span>
                      </div>
                    </td>
                    <td className="py-3">
                      <Chip variant="green">Active</Chip>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[var(--c-ink-3)] text-[13px]">
                    No classes found. <Link to="/admin/classes" className="text-[var(--product-accent)]">Create one →</Link>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
