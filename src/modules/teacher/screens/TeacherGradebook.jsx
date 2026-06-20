/**
 * TeacherGradebook.jsx
 * Enter and view assessment scores for all pupils in a class.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import {
  PageHeader, Card, CardHeader, Chip, Button,
  Avatar, Select, Input, LoadingScreen, Empty, ProgressBar,
} from '@/components/ui';

const SUBJECTS      = ['Mathematics','English Language','Basic Science','Social Studies','CRS','Cultural & Creative Arts','Physical & Health Education'];
const ASSESS_TYPES  = ['CA1','CA2','Exam','Project','Practical'];
const MAX_SCORES    = { CA1: 20, CA2: 20, Exam: 60, Project: 20, Practical: 20 };

function gradeLabel(pct) {
  if (pct >= 80) return { label: 'A', variant: 'green'   };
  if (pct >= 70) return { label: 'B', variant: 'teal'    };
  if (pct >= 60) return { label: 'C', variant: 'amber'   };
  if (pct >= 50) return { label: 'D', variant: 'coral'   };
  return           { label: 'F', variant: 'red'     };
}

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

function usePupilsWithScores(classId, subject, assessType) {
  return useQuery({
    queryKey: ['teacher-gradebook', classId, subject, assessType],
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
        .select('pupil_id,score')
        .eq('class_id', classId)
        .eq('subject', subject)
        .eq('assessment_type', assessType);

      const scoreMap = Object.fromEntries((scores ?? []).map(s => [s.pupil_id, s.score]));
      return (pupils ?? []).map(p => ({ ...p, score: scoreMap[p.id] ?? null }));
    },
    enabled: !!classId,
  });
}

export default function TeacherGradebook() {
  const { profile, schoolId } = useAuth();
  const qc = useQueryClient();

  const [classId,    setClassId]    = useState('');
  const [subject,    setSubject]    = useState('');
  const [assessType, setAssessType] = useState('');
  const [localScores, setLocal]     = useState({});
  const [savingId,    setSavingId]  = useState(null);

  const { data: classes = [] }               = useTeacherClasses(profile?.id);
  const { data: pupils  = [], isLoading }    = usePupilsWithScores(classId, subject, assessType);

  const maxScore = MAX_SCORES[assessType] ?? 100;

  const saveScore = useMutation({
    mutationFn: async ({ pupilId, score }) => {
      setSavingId(pupilId);
      const { error } = await supabase
        .from('assessment_scores')
        .upsert({
          pupil_id:        pupilId,
          class_id:        classId,
          school_id:       schoolId,
          subject,
          assessment_type: assessType,
          score:           Number(score),
          max_score:       maxScore,
          term:            3,
        }, { onConflict: 'pupil_id,class_id,subject,assessment_type,term' });
      if (error) throw error;
    },
    onSettled: () => setSavingId(null),
    onSuccess: () => qc.invalidateQueries(['teacher-gradebook', classId, subject, assessType]),
  });

  const handleBlur = (pupilId) => {
    const score = localScores[pupilId];
    if (score !== undefined && score !== '') saveScore.mutate({ pupilId, score });
  };

  // Stats
  const scores = pupils
    .map(p => localScores[p.id] !== undefined ? Number(localScores[p.id]) : p.score)
    .filter(s => s !== null && !isNaN(s));
  const avg    = scores.length ? Math.round(scores.reduce((a,b) => a + b, 0) / scores.length) : null;
  const high   = scores.length ? Math.max(...scores) : null;
  const low    = scores.length ? Math.min(...scores) : null;

  return (
    <div>
      <PageHeader
        eyebrow="Teacher"
        title="Gradebook"
        subtitle="Enter and review assessment scores for your class."
      >
        <Button variant="ghost" icon="download">Export grades</Button>
      </PageHeader>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Select className="max-w-[180px]" value={classId} onChange={e => { setClassId(e.target.value); setLocal({}); }}>
          <option value="">Select class…</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Select className="max-w-[200px]" value={subject} onChange={e => setSubject(e.target.value)}>
          <option value="">Select subject…</option>
          {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Select className="max-w-[160px]" value={assessType} onChange={e => { setAssessType(e.target.value); setLocal({}); }}>
          <option value="">Assessment type…</option>
          {ASSESS_TYPES.map(t => <option key={t} value={t}>{t} (/{MAX_SCORES[t]})</option>)}
        </Select>
      </div>

      {/* Summary strip */}
      {scores.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: 'Class average', value: `${avg}/${maxScore}`, pct: Math.round((avg/maxScore)*100) },
            { label: 'Highest score', value: `${high}/${maxScore}`, pct: Math.round((high/maxScore)*100) },
            { label: 'Lowest score',  value: `${low}/${maxScore}`,  pct: Math.round((low/maxScore)*100)  },
          ].map(s => (
            <div key={s.label} className="bg-[var(--c-surface-2)] border border-[var(--c-line-2)] rounded-xl p-4">
              <div className="text-[10px] font-mono uppercase tracking-[0.1em] text-[var(--c-ink-3)] mb-1">{s.label}</div>
              <div className="font-heading text-[22px] font-bold text-[var(--c-ink-0)]">{s.value}</div>
              <ProgressBar value={s.pct} className="mt-2" color={s.pct >= 70 ? 'var(--c-green-400)' : s.pct >= 50 ? 'var(--product-accent)' : 'var(--c-red-400)'} />
            </div>
          ))}
        </div>
      )}

      {!classId || !subject || !assessType ? (
        <Card>
          <div className="py-10 text-center text-[13px] text-[var(--c-ink-3)]">
            Select a class, subject, and assessment type to enter scores.
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
                {pupils.map((pupil, i) => {
                  const scoreVal = localScores[pupil.id] !== undefined ? localScores[pupil.id] : (pupil.score ?? '');
                  const numScore = scoreVal !== '' ? Number(scoreVal) : null;
                  const pct      = numScore !== null ? Math.round((numScore / maxScore) * 100) : null;
                  const grade    = pct !== null ? gradeLabel(pct) : null;
                  const isSaving = savingId === pupil.id;

                  return (
                    <tr key={pupil.id} className="border-b border-[var(--c-line-1)] last:border-0 hover:bg-[var(--c-surface-3)] transition-colors">
                      <td className="px-5 py-3 text-[var(--c-ink-4)] font-mono text-[11px]">{i+1}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar name={`${pupil.first_name} ${pupil.last_name}`} size="sm" />
                          <span className="font-medium text-[var(--c-ink-0)]">{pupil.first_name} {pupil.last_name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={0}
                            max={maxScore}
                            className="w-20 text-center py-1.5"
                            value={scoreVal}
                            onChange={e => setLocal(prev => ({ ...prev, [pupil.id]: e.target.value }))}
                            onBlur={() => handleBlur(pupil.id)}
                            placeholder="—"
                          />
                          {isSaving && <div className="w-3 h-3 border-2 border-[var(--product-accent)] border-t-transparent rounded-full animate-spin" />}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        {pct !== null ? (
                          <div className="flex items-center gap-2 min-w-[80px]">
                            <ProgressBar value={pct} className="flex-1" color={pct >= 70 ? 'var(--c-green-400)' : pct >= 50 ? 'var(--product-accent)' : 'var(--c-red-400)'} />
                            <span className="text-[11px] text-[var(--c-ink-2)] w-7 text-right">{pct}%</span>
                          </div>
                        ) : '—'}
                      </td>
                      <td className="px-5 py-3">
                        {grade ? <Chip variant={grade.variant} size="sm">{grade.label}</Chip> : <span className="text-[var(--c-ink-4)]">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
