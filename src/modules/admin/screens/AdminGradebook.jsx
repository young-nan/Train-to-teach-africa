/**
 * AdminGradebook.jsx — Admin view of all class gradebooks
 * Class selector → subject → assessment type → read-only overview
 * Can drill into any class and see consolidated grades.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import {
  PageHeader, Card, CardHeader, KpiCard, Chip, Button,
  Avatar, Select, ProgressBar, LoadingScreen, Empty, Tabs,
} from '@/components/ui';

const SUBJECTS     = ['Mathematics','English Language','Basic Science','Social Studies','CRS','Cultural & Creative Arts'];
const ASSESS_TYPES = ['CA1','CA2','Exam','Project','Practical'];
const MAX_SCORES   = { CA1:20, CA2:20, Exam:60, Project:20, Practical:20 };

function gradeLabel(pct) {
  if (pct >= 80) return { g:'A', v:'green'   };
  if (pct >= 70) return { g:'B', v:'teal'    };
  if (pct >= 60) return { g:'C', v:'amber'   };
  if (pct >= 50) return { g:'D', v:'coral'   };
  return           { g:'F', v:'red'     };
}

function useClasses(schoolId) {
  return useQuery({
    queryKey: ['admin-classes', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('classes').select('id,name').eq('school_id', schoolId).order('name');
      return data ?? [];
    },
    enabled: !!schoolId,
  });
}

function useGrades(classId, subject, assessType) {
  return useQuery({
    queryKey: ['admin-grades', classId, subject, assessType],
    queryFn: async () => {
      if (!classId) return [];
      const { data: pupils } = await supabase
        .from('pupils')
        .select('id,first_name,last_name')
        .eq('class_id', classId)
        .order('first_name');

      if (!subject || !assessType) return (pupils ?? []).map(p => ({ ...p, score: null }));

      const { data: scores } = await supabase
        .from('assessment_scores')
        .select('pupil_id,score,max_score')
        .eq('class_id', classId)
        .eq('subject', subject)
        .eq('assessment_type', assessType);

      const scoreMap = Object.fromEntries((scores ?? []).map(s => [s.pupil_id, s.score]));
      return (pupils ?? []).map(p => ({ ...p, score: scoreMap[p.id] ?? null }));
    },
    enabled: !!classId,
    staleTime: 30_000,
  });
}

function useClassSummary(classId) {
  return useQuery({
    queryKey: ['admin-class-summary', classId],
    queryFn: async () => {
      if (!classId) return null;
      const { data } = await supabase
        .from('assessment_scores')
        .select('subject,score,max_score,assessment_type')
        .eq('class_id', classId);
      if (!data?.length) return null;

      // Group by subject
      const bySubject = {};
      data.forEach(r => {
        if (!bySubject[r.subject]) bySubject[r.subject] = [];
        if (r.max_score) bySubject[r.subject].push(Math.round((r.score / r.max_score) * 100));
      });

      return Object.entries(bySubject).map(([sub, pcts]) => ({
        subject: sub,
        avg: Math.round(pcts.reduce((a,b) => a+b, 0) / pcts.length),
        count: pcts.length,
      }));
    },
    enabled: !!classId,
  });
}

const TABS = [
  { key:'assessment', label:'Assessment entry' },
  { key:'summary',    label:'Class summary'    },
];

export default function AdminGradebook() {
  const { profile, schoolId } = useAuth();
  const schoolId = schoolId;

  const [tab,        setTab]       = useState('assessment');
  const [classId,    setClassId]   = useState('');
  const [subject,    setSubject]   = useState('');
  const [assessType, setAssess]    = useState('');

  const { data: classes = [] }            = useClasses(schoolId);
  const { data: grades  = [], isLoading } = useGrades(classId, subject, assessType);
  const { data: summary = [] }            = useClassSummary(classId);

  const maxScore = MAX_SCORES[assessType] ?? 100;

  const scores = grades.map(g => g.score).filter(s => s !== null);
  const avg    = scores.length ? Math.round(scores.reduce((a,b) => a+b,0)/scores.length) : null;
  const high   = scores.length ? Math.max(...scores) : null;
  const low    = scores.length ? Math.min(...scores) : null;
  const pass   = scores.length ? scores.filter(s => s/maxScore >= 0.5).length : null;

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Gradebook"
        subtitle="View and manage assessment scores across all classes."
      >
        <Button variant="ghost" icon="download">Export grades</Button>
      </PageHeader>

      {/* Class + filter bar */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Select className="max-w-[200px]" value={classId} onChange={e => { setClassId(e.target.value); setSubject(''); setAssess(''); }}>
          <option value="">Select class…</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        {tab === 'assessment' && (
          <>
            <Select className="max-w-[220px]" value={subject} onChange={e => setSubject(e.target.value)} disabled={!classId}>
              <option value="">Select subject…</option>
              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
            <Select className="max-w-[180px]" value={assessType} onChange={e => setAssess(e.target.value)} disabled={!subject}>
              <option value="">Assessment type…</option>
              {ASSESS_TYPES.map(t => <option key={t} value={t}>{t} (/{MAX_SCORES[t]})</option>)}
            </Select>
          </>
        )}
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {/* ── Assessment entry tab ── */}
      {tab === 'assessment' && (
        <>
          {/* Stats strip */}
          {scores.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
              <KpiCard label="Class average" value={`${avg}/${maxScore}`} deltaDir="flat" icon="chart-bar"    />
              <KpiCard label="Highest score" value={high ?? '—'}          deltaDir="up"   icon="trending-up"  />
              <KpiCard label="Lowest score"  value={low  ?? '—'}          deltaDir="down" icon="trending-down" />
              <KpiCard label="Pass rate"     value={`${Math.round((pass/scores.length)*100)}%`} deltaDir="flat" icon="circle-check" />
            </div>
          )}

          {!classId || !subject || !assessType ? (
            <Card>
              <div className="py-10 text-center text-[13px] text-[var(--c-ink-3)]">
                Select a class, subject, and assessment type to view grades.
              </div>
            </Card>
          ) : isLoading ? (
            <LoadingScreen />
          ) : (
            <Card padding={false}>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-[var(--c-line-2)]">
                      {['#','Student',`Score (/${maxScore})`,'%','Grade'].map(h => (
                        <th key={h} className="text-left px-5 py-3 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--c-ink-3)]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {grades.map((pupil, i) => {
                      const pct   = pupil.score !== null ? Math.round((pupil.score / maxScore) * 100) : null;
                      const grade = pct !== null ? gradeLabel(pct) : null;
                      return (
                        <tr key={pupil.id} className="border-b border-[var(--c-line-1)] last:border-0 hover:bg-[var(--c-surface-3)] transition-colors">
                          <td className="px-5 py-3 text-[var(--c-ink-4)] font-mono text-[11px]">{i+1}</td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <Avatar name={`${pupil.first_name} ${pupil.last_name}`} size="sm" />
                              <span className="font-medium text-[var(--c-ink-0)]">{pupil.first_name} {pupil.last_name}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3 font-mono font-semibold text-[var(--c-ink-1)]">
                            {pupil.score !== null ? `${pupil.score}` : '—'}
                          </td>
                          <td className="px-5 py-3 min-w-[120px]">
                            {pct !== null ? (
                              <div className="flex items-center gap-2">
                                <ProgressBar value={pct} className="flex-1"
                                  color={pct>=70?'var(--c-green-400)':pct>=50?'var(--product-accent)':'var(--c-red-400)'} />
                                <span className="text-[11px] text-[var(--c-ink-3)] w-8 text-right">{pct}%</span>
                              </div>
                            ) : <span className="text-[var(--c-ink-4)]">No score</span>}
                          </td>
                          <td className="px-5 py-3">
                            {grade
                              ? <Chip variant={grade.v} size="sm">{grade.g}</Chip>
                              : <Chip variant="default" size="sm">—</Chip>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* ── Summary tab ── */}
      {tab === 'summary' && (
        !classId ? (
          <Card>
            <div className="py-10 text-center text-[13px] text-[var(--c-ink-3)]">Select a class to view its summary.</div>
          </Card>
        ) : !summary?.length ? (
          <Empty icon="chart-bar" message="No assessment data yet for this class." />
        ) : (
          <Card>
            <CardHeader title={`Subject averages — ${classes.find(c=>c.id===classId)?.name ?? ''}`} />
            <div className="space-y-1">
              {summary.sort((a,b) => b.avg - a.avg).map(row => {
                const grade = gradeLabel(row.avg);
                return (
                  <div key={row.subject} className="flex items-center gap-4 py-3 border-b border-[var(--c-line-1)] last:border-0">
                    <div className="w-40 shrink-0 text-[13px] font-medium text-[var(--c-ink-1)]">{row.subject}</div>
                    <div className="flex-1">
                      <ProgressBar value={row.avg}
                        color={row.avg>=70?'var(--c-green-400)':row.avg>=50?'var(--product-accent)':'var(--c-red-400)'} />
                    </div>
                    <div className="text-[13px] font-semibold text-[var(--c-ink-0)] w-10 text-right">{row.avg}%</div>
                    <Chip variant={grade.v} size="sm">{grade.g}</Chip>
                    <div className="text-[11px] text-[var(--c-ink-4)] w-16 text-right">{row.count} entries</div>
                  </div>
                );
              })}
            </div>
          </Card>
        )
      )}
    </div>
  );
}
