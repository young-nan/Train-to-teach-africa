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
      const [classesRes, pupilsRes, intRes, attRes, scoresRes] = await Promise.all([
        // classes -> teacher via the classes_teacher_id_fkey constraint (the
        // FK lives on classes, so this is the correct embed direction —
        // querying profiles and trying to embed classes(...) the other way
        // around is ambiguous about cardinality and was never actually
        // rendered by this screen before this fix).
        supabase.from('classes')
          .select('id,name,teacher_id,teacher:profiles!classes_teacher_id_fkey(user_id,first_name,last_name)')
          .eq('school_id', schoolId),
        supabase.from('pupils').select('id,first_name,last_name,class_id,status').eq('school_id', schoolId),
        supabase.from('interventions')
          .select('id,severity,type,description,pupil:pupils(id,first_name,last_name,class_id)')
          .eq('school_id', schoolId).eq('resolved', false),
        supabase.from('attendance_records').select('class_id,pupil_id,status,date')
          .eq('school_id', schoolId)
          .gte('date', new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10)),
        supabase.from('assessment_scores').select('pupil_id,score,max_score')
          .eq('school_id', schoolId),
      ]);

      const classes       = classesRes.data ?? [];
      const pupils         = pupilsRes.data ?? [];
      const interventions = intRes.data ?? [];
      const attendance     = attRes.data ?? [];
      const scores         = scoresRes.data ?? [];

      // Aggregate attendance and pupil counts PER CLASS — done here in JS
      // rather than as a single nested PostgREST embed, because embedding
      // pupils(...) and attendance_records(...) as siblings under the same
      // classes row causes a join fan-out (2 pupils × 2 attendance rows
      // = 4 "rows" instead of 2) that silently inflates every count.
      const pupilCountByClass = {};
      const pupilsByClass = {};
      pupils.forEach(p => {
        pupilCountByClass[p.class_id] = (pupilCountByClass[p.class_id] ?? 0) + 1;
        (pupilsByClass[p.class_id] ??= []).push(p);
      });

      const attByClass = {};
      attendance.forEach(a => {
        if (!attByClass[a.class_id]) attByClass[a.class_id] = { total: 0, present: 0 };
        attByClass[a.class_id].total++;
        if (a.status === 'present') attByClass[a.class_id].present++;
      });

      // Per-pupil average score, to flag "at risk" (avg < 50%)
      const scoresByPupil = {};
      scores.forEach(s => {
        if (!scoresByPupil[s.pupil_id]) scoresByPupil[s.pupil_id] = [];
        if (s.max_score) scoresByPupil[s.pupil_id].push((s.score / s.max_score) * 100);
      });

      const teacherPerf = classes.map(c => {
        const att = attByClass[c.id] ?? { total: 0, present: 0 };
        return {
          teacherId:    c.teacher_id,
          teacherName:  c.teacher ? `${c.teacher.first_name} ${c.teacher.last_name}` : null,
          className:    c.name,
          pupilCount:   pupilCountByClass[c.id] ?? 0,
          attendancePct: att.total ? Math.round((att.present / att.total) * 100) : null,
        };
      });

      // At-risk pupils: low attendance OR low average score
      const classNameById = Object.fromEntries(classes.map(c => [c.id, c.name]));
      const atRisk = [];
      pupils.forEach(p => {
        const pupilAtt = attendance.filter(a => a.pupil_id === p.id);
        const attPct = pupilAtt.length ? Math.round((pupilAtt.filter(a => a.status === 'present').length / pupilAtt.length) * 100) : null;
        const pupilScores = scoresByPupil[p.id] ?? [];
        const avgScore = pupilScores.length ? Math.round(pupilScores.reduce((a, b) => a + b, 0) / pupilScores.length) : null;

        if ((attPct !== null && attPct < 75) || (avgScore !== null && avgScore < 50)) {
          atRisk.push({
            pupilId: p.id,
            name: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim(),
            className: classNameById[p.class_id] ?? '—',
            attPct, avgScore,
            severity: (attPct !== null && attPct < 50) || (avgScore !== null && avgScore < 35) ? 'high' : 'medium',
            reason: attPct !== null && attPct < 75
              ? `Attendance at ${attPct}%`
              : `Average score ${avgScore}%`,
          });
        }
      });

      const att      = attendance;
      const present  = att.filter(r => r.status === 'present').length;
      const attPct   = att.length ? Math.round((present / att.length) * 100) : 0;

      return {
        classes, pupils, interventions,
        teacherPerf, atRisk,
        attPct,
        teacherCount: new Set(classes.map(c => c.teacher_id).filter(Boolean)).size,
      };
    },
    enabled: !!schoolId,
    staleTime: 60_000,
  });
}

export default function HTOverview() {
  const { profile, schoolId } = useAuth();
  const { data, isLoading }   = useHTSummary(schoolId);

  if (isLoading) return <LoadingScreen />;

  const highRisk = data?.atRisk?.filter(r => r.severity === 'high').length ?? 0;
  const openInterventions = data?.interventions?.length ?? 0;

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
        <KpiCard label="Teachers"          value={data?.teacherCount ?? '—'}                              deltaDir="flat" icon="id-badge-2"     href="/headteacher/teachers" />
        <KpiCard label="Total students"    value={data?.pupils?.length ?? '—'}                            deltaDir="flat" icon="users"          href="/headteacher/students" />
        <KpiCard label="Weekly attendance" value={data?.attPct != null ? `${data.attPct}%` : '—'}        deltaDir={data?.attPct >= 90 ? 'up' : 'down'} delta="This week" icon="calendar-stats" href="/headteacher/attendance" />
        <KpiCard label="Open interventions" value={openInterventions}                                    deltaDir={openInterventions > 0 ? 'down' : 'flat'} delta={highRisk > 0 ? `${highRisk} high risk` : 'All clear'} icon="alert-triangle" href="/headteacher/interventions" />
      </div>

      {/* High-risk alert */}
      {highRisk > 0 && (
        <Alert type="error" className="mb-5">
          {highRisk} high-risk student{highRisk !== 1 ? 's' : ''} need{highRisk === 1 ? 's' : ''} your attention.
        </Alert>
      )}

      <div className="grid lg:grid-cols-2 gap-4 mb-4">

        {/* Teacher performance */}
        <Card>
          <CardHeader title="Teacher performance — this week" />
          <div className="space-y-1">
            {!data?.teacherPerf?.length ? (
              <div className="py-6 text-center text-[13px] text-[var(--c-ink-3)]">
                No classes have an assigned teacher yet.
              </div>
            ) : data.teacherPerf.map((t, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-[var(--c-surface-3)] transition-colors">
                <Avatar name={t.teacherName ?? '?'} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-[var(--c-ink-1)] truncate">
                    {t.teacherName ?? 'Unassigned'}
                  </div>
                  <div className="text-[11px] text-[var(--c-ink-3)]">{t.className} · {t.pupilCount} student{t.pupilCount !== 1 ? 's' : ''}</div>
                </div>
                <div className="text-right shrink-0">
                  {t.attendancePct != null ? (
                    <div className="text-[12px] font-semibold"
                      style={{ color: t.attendancePct >= 90 ? 'var(--c-green-400)' : t.attendancePct >= 75 ? 'var(--product-accent)' : 'var(--c-red-400)' }}>
                      {t.attendancePct}% att.
                    </div>
                  ) : (
                    <span className="text-[11px] text-[var(--c-ink-4)]">No data</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* At-risk students */}
        <Card>
          <CardHeader title="Students requiring attention" />
          <div className="space-y-2">
            {!data?.atRisk?.length ? (
              <div className="py-6 text-center text-[13px] text-[var(--c-ink-3)]">
                No students currently flagged. 🎉
              </div>
            ) : data.atRisk.slice(0, 6).map((s, i) => (
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
                  <div className="text-[11px] text-[var(--c-ink-3)] mt-0.5">{s.className} · {s.reason}</div>
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
        {!data?.teacherPerf?.length ? (
          <div className="py-6 text-center text-[13px] text-[var(--c-ink-3)]">No classes yet.</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {data.teacherPerf.map((c, i) => (
              <div key={i} className="bg-[var(--c-surface-3)] rounded-xl p-4">
                <div className="font-heading font-bold text-[15px] text-[var(--c-ink-0)] mb-0.5">{c.className}</div>
                <div className="text-[11px] text-[var(--c-ink-3)] mb-3">{c.teacherName ?? 'Unassigned'}</div>
                {c.attendancePct != null ? (
                  <>
                    <div className="font-heading text-[28px] font-bold mb-1"
                      style={{ color: c.attendancePct >= 90 ? 'var(--c-green-400)' : 'var(--product-accent)' }}>
                      {c.attendancePct}%
                    </div>
                    <ProgressBar value={c.attendancePct} color={c.attendancePct >= 90 ? 'var(--c-green-400)' : 'var(--product-accent)'} />
                  </>
                ) : (
                  <div className="text-[12px] text-[var(--c-ink-4)] py-2">No records yet</div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
