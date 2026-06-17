/**
 * TeacherReports.jsx — Full class performance reporting
 * Term summary · Subject breakdown · Generate/export reports
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import {
  PageHeader, Card, CardHeader, KpiCard, Chip, Button,
  Select, ProgressBar, LoadingScreen, Empty, Tabs, Avatar,
} from '@/components/ui';

const TABS = [
  { key:'overview', label:'Class overview' },
  { key:'students',  label:'Per-student'    },
];

function useTeacherClasses(teacherId) {
  return useQuery({
    queryKey: ['teacher-classes', teacherId],
    queryFn: async () => {
      if (!teacherId) return [];
      const { data } = await supabase.from('classes').select('id,name').eq('teacher_id', teacherId).order('name');
      return data ?? [];
    },
    enabled: !!teacherId,
  });
}

function useClassReport(classId) {
  return useQuery({
    queryKey: ['teacher-class-report', classId],
    queryFn: async () => {
      if (!classId) return null;

      const [pupilsRes, scoresRes, attRes] = await Promise.all([
        supabase.from('pupils').select('id,first_name,last_name').eq('class_id', classId),
        supabase.from('assessment_scores').select('pupil_id,subject,score,max_score').eq('class_id', classId),
        supabase.from('attendance_records').select('pupil_id,status').eq('class_id', classId),
      ]);

      const pupils = pupilsRes.data ?? [];
      const scores = scoresRes.data ?? [];
      const att    = attRes.data ?? [];

      // Per-pupil aggregation
      const perPupil = pupils.map(p => {
        const pScores = scores.filter(s => s.pupil_id === p.id);
        const pAtt    = att.filter(a => a.pupil_id === p.id);
        const avg     = pScores.length ? Math.round(pScores.reduce((a,s)=>a+(s.score/s.max_score)*100,0)/pScores.length) : null;
        const attPct  = pAtt.length ? Math.round((pAtt.filter(a=>a.status==='present').length/pAtt.length)*100) : null;
        return { ...p, avg, attPct };
      });

      // Subject aggregation
      const bySubject = {};
      scores.forEach(s => {
        if (!bySubject[s.subject]) bySubject[s.subject] = [];
        bySubject[s.subject].push((s.score/s.max_score)*100);
      });
      const subjectAverages = Object.entries(bySubject).map(([sub, pcts]) => ({
        subject: sub,
        avg: Math.round(pcts.reduce((a,b)=>a+b,0)/pcts.length),
      }));

      const classAvg = perPupil.filter(p=>p.avg!=null).length
        ? Math.round(perPupil.filter(p=>p.avg!=null).reduce((a,p)=>a+p.avg,0)/perPupil.filter(p=>p.avg!=null).length)
        : null;

      const classAtt = perPupil.filter(p=>p.attPct!=null).length
        ? Math.round(perPupil.filter(p=>p.attPct!=null).reduce((a,p)=>a+p.attPct,0)/perPupil.filter(p=>p.attPct!=null).length)
        : null;

      return { perPupil, subjectAverages, classAvg, classAtt, totalStudents: pupils.length };
    },
    enabled: !!classId,
    staleTime: 60_000,
  });
}

export default function TeacherReports() {
  const { profile } = useAuth();
  const [tab, setTab]         = useState('overview');
  const [classId, setClassId] = useState('');

  const { data: classes = [] }         = useTeacherClasses(profile?.id);
  const { data: report, isLoading }    = useClassReport(classId);

  return (
    <div>
      <PageHeader
        eyebrow="Teacher"
        title="Reports"
        subtitle="Class performance, attendance, and term summaries."
      >
        <Button variant="ghost" icon="download">Export report</Button>
      </PageHeader>

      <div className="mb-5">
        <Select className="max-w-[220px]" value={classId} onChange={e => setClassId(e.target.value)}>
          <option value="">Select class…</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </div>

      {!classId ? (
        <Card><div className="py-10 text-center text-[13px] text-[var(--c-ink-3)]">Select a class to view its report.</div></Card>
      ) : isLoading ? (
        <LoadingScreen />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <KpiCard label="Class average"   value={report?.classAvg != null ? `${report.classAvg}%` : '—'} deltaDir="up"   icon="chart-bar"     />
            <KpiCard label="Pass rate"       value={report?.perPupil?.length ? `${Math.round((report.perPupil.filter(p=>p.avg>=50).length/report.perPupil.length)*100)}%` : '—'} deltaDir="up" icon="circle-check" />
            <KpiCard label="Attendance"      value={report?.classAtt != null ? `${report.classAtt}%` : '—'} deltaDir="flat" icon="calendar-stats"/>
            <KpiCard label="Students"        value={report?.totalStudents ?? '—'}                            deltaDir="flat" icon="users"         />
          </div>

          <Tabs tabs={TABS} active={tab} onChange={setTab} />

          {tab === 'overview' && (
            !report?.subjectAverages?.length ? (
              <Empty icon="chart-bar" message="No assessment data recorded yet for this class." />
            ) : (
              <Card>
                <CardHeader title="Subject performance" />
                {report.subjectAverages.sort((a,b)=>b.avg-a.avg).map(s => (
                  <div key={s.subject} className="flex items-center gap-4 py-3 border-b border-[var(--c-line-1)] last:border-0">
                    <div className="w-40 shrink-0 text-[13px] font-medium text-[var(--c-ink-1)] truncate">{s.subject}</div>
                    <div className="flex-1">
                      <ProgressBar value={s.avg} color={s.avg>=70?'var(--c-green-400)':s.avg>=50?'var(--product-accent)':'var(--c-red-400)'} />
                    </div>
                    <div className="text-[13px] font-semibold text-[var(--c-ink-0)] w-10 text-right">{s.avg}%</div>
                    <Chip variant={s.avg>=80?'green':s.avg>=70?'teal':s.avg>=60?'amber':'red'} size="sm">
                      {s.avg>=80?'A':s.avg>=70?'B':s.avg>=60?'C':s.avg>=50?'D':'F'}
                    </Chip>
                  </div>
                ))}
              </Card>
            )
          )}

          {tab === 'students' && (
            !report?.perPupil?.length ? (
              <Empty icon="users" message="No students in this class." />
            ) : (
              <Card padding={false}>
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="border-b border-[var(--c-line-2)]">
                        {['Student','Average score','Attendance','Status'].map(h => (
                          <th key={h} className="text-left px-5 py-3 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--c-ink-3)]">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {report.perPupil.map(p => (
                        <tr key={p.id} className="border-b border-[var(--c-line-1)] last:border-0 hover:bg-[var(--c-surface-3)] transition-colors">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <Avatar name={`${p.first_name} ${p.last_name}`} size="sm" />
                              <span className="font-medium text-[var(--c-ink-0)]">{p.first_name} {p.last_name}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3 min-w-[120px]">
                            {p.avg != null ? (
                              <div className="flex items-center gap-2">
                                <ProgressBar value={p.avg} className="flex-1" color={p.avg>=70?'var(--c-green-400)':p.avg>=50?'var(--product-accent)':'var(--c-red-400)'} />
                                <span className="text-[11px] text-[var(--c-ink-2)] w-8 text-right">{p.avg}%</span>
                              </div>
                            ) : <span className="text-[var(--c-ink-4)]">No scores</span>}
                          </td>
                          <td className="px-5 py-3">
                            {p.attPct != null ? (
                              <Chip variant={p.attPct>=90?'green':p.attPct>=70?'amber':'red'} size="sm">{p.attPct}%</Chip>
                            ) : <span className="text-[var(--c-ink-4)]">—</span>}
                          </td>
                          <td className="px-5 py-3">
                            {p.avg != null && p.avg < 50
                              ? <Chip variant="red" size="sm">At risk</Chip>
                              : <Chip variant="green" size="sm">On track</Chip>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )
          )}
        </>
      )}
    </div>
  );
}
