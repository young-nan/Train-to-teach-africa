/**
 * ParentTonight.jsx
 * The parent's home screen — tonight's lesson, progress highlights,
 * dinner conversation starter, badges earned.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import {
  PageHeader, Card, CardHeader, KpiCard, Chip, Button,
  ProgressBar, LoadingScreen, Empty, ListItem, Divider,
} from '@/components/ui';

const SUBJECT_COLORS = {
  'Mathematics':        '#e5a62a',
  'English Language':   '#3b82f6',
  'Basic Science':      '#3fb950',
  'Social Studies':     '#22b8a6',
  'CRS':                '#f97066',
  'default':            '#7c3aed',
};

function subjectColor(sub) {
  return SUBJECT_COLORS[sub] ?? SUBJECT_COLORS.default;
}

function useChildren(parentId) {
  return useQuery({
    queryKey: ['parent-children', parentId],
    queryFn: async () => {
      if (!parentId) return [];
      const { data } = await supabase
        .from('pupils')
        .select('id, first_name, last_name, classes(name)')
        .eq('parent_id', parentId);
      return data ?? [];
    },
    enabled: !!parentId,
  });
}

function useTonightLesson(pupilId) {
  return useQuery({
    queryKey: ['tonight-lesson', pupilId],
    queryFn: async () => {
      if (!pupilId) return null;
      // Get current lesson progress
      const { data } = await supabase
        .from('lesson_progress')
        .select('*, lessons(title, subject, week_number, lesson_notes)')
        .eq('pupil_id', pupilId)
        .eq('status', 'in_progress')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!pupilId,
  });
}

function useChildProgress(pupilId) {
  return useQuery({
    queryKey: ['child-progress', pupilId],
    queryFn: async () => {
      if (!pupilId) return null;
      const [attRes, scoreRes, streakRes] = await Promise.all([
        supabase.from('attendance_records').select('status').eq('pupil_id', pupilId),
        supabase.from('assessment_scores').select('score, max_score, subject').eq('pupil_id', pupilId),
        supabase.from('lesson_progress').select('completed_at').eq('pupil_id', pupilId).eq('status','completed').order('completed_at', { ascending: false }).limit(30),
      ]);

      const att    = attRes.data ?? [];
      const attPct = att.length ? Math.round((att.filter(r => r.status==='present').length / att.length) * 100) : 0;

      const scores  = scoreRes.data ?? [];
      const avgScore = scores.length ? Math.round(scores.reduce((a,b) => a + (b.score/b.max_score)*100, 0) / scores.length) : 0;

      return { attPct, avgScore, completedLessons: streakRes.data?.length ?? 0 };
    },
    enabled: !!pupilId,
  });
}

function BadgeCard({ emoji, name, earned }) {
  return (
    <div className="text-center p-3 rounded-xl transition-all"
      style={{
        background: earned ? 'rgba(251,113,133,0.08)' : 'var(--c-surface-4)',
        border: `1px solid ${earned ? 'rgba(251,113,133,0.2)' : 'transparent'}`,
      }}>
      <div className="text-2xl mb-1" style={{ opacity: earned ? 1 : 0.25 }}>{emoji}</div>
      <div className="text-[10px] font-semibold" style={{ color: earned ? 'var(--c-ink-1)' : 'var(--c-ink-4)' }}>{name}</div>
    </div>
  );
}

export default function ParentTonight() {
  const { profile } = useAuth();
  const [activeChildIdx, setActiveChildIdx] = useState(0);

  const { data: children = [], isLoading: loadingChildren } = useChildren(profile?.id);
  const activeChild = children[activeChildIdx];

  const { data: tonightLesson }  = useTonightLesson(activeChild?.id);
  const { data: progress }       = useChildProgress(activeChild?.id);

  if (loadingChildren) return <LoadingScreen />;

  const lesson = tonightLesson?.lessons;
  const color  = lesson ? subjectColor(lesson.subject) : 'var(--product-accent)';

  return (
    <div>
      <PageHeader
        eyebrow="Parent"
        title="Tonight's learning"
        subtitle={new Date().toLocaleDateString('en-NG', { weekday:'long', day:'numeric', month:'long' })}
      />

      {children.length === 0 ? (
        <Empty
          icon="users"
          message="No children linked to your account yet."
          action={<Button variant="primary" icon="plus">Add a child</Button>}
        />
      ) : (
        <>
          {/* Child selector tabs */}
          {children.length > 1 && (
            <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
              {children.map((child, i) => (
                <button
                  key={child.id}
                  onClick={() => setActiveChildIdx(i)}
                  className="shrink-0 px-4 py-2 rounded-full text-[13px] font-semibold transition-all"
                  style={{
                    background: i === activeChildIdx ? 'rgba(251,113,133,0.15)' : 'var(--c-surface-3)',
                    color:      i === activeChildIdx ? 'var(--product-accent)' : 'var(--c-ink-3)',
                    border:     `1px solid ${i === activeChildIdx ? 'var(--product-accent)' : 'transparent'}`,
                  }}
                >
                  {child.first_name} ({child.classes?.name ?? '—'})
                </button>
              ))}
            </div>
          )}

          {/* Hero lesson card */}
          {lesson ? (
            <div
              className="p-5 rounded-2xl mb-5 flex flex-col sm:flex-row items-start sm:items-center gap-5"
              style={{
                background: `linear-gradient(135deg, ${color}15, ${color}06)`,
                border: `1px solid ${color}30`,
              }}
            >
              <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 text-3xl"
                style={{ background: `${color}25` }}>📚</div>
              <div className="flex-1 min-w-0">
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] mb-1" style={{ color }}>
                  Up next for {activeChild?.first_name}
                </div>
                <div className="font-heading text-[20px] font-bold text-[var(--c-ink-0)] leading-tight">{lesson.title}</div>
                <div className="text-[12px] text-[var(--c-ink-3)] mt-1">
                  {lesson.subject} · Week {lesson.week_number} · ~25 mins
                </div>
              </div>
              <Button variant="primary" icon="player-play" className="shrink-0">Start lesson</Button>
            </div>
          ) : (
            <div className="p-5 rounded-2xl mb-5 bg-[var(--c-surface-2)] border border-[var(--c-line-2)] text-center">
              <div className="text-2xl mb-2">🎉</div>
              <div className="text-[14px] font-semibold text-[var(--c-ink-0)]">All caught up!</div>
              <div className="text-[12px] text-[var(--c-ink-3)] mt-1">
                {activeChild?.first_name} has completed all lessons for today.
              </div>
            </div>
          )}

          {/* KPI strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <KpiCard label="Attendance"     value={`${progress?.attPct ?? '—'}%`} deltaDir="up"   delta="This term" icon="calendar-check" />
            <KpiCard label="Average score"  value={`${progress?.avgScore ?? '—'}%`} deltaDir="up" delta="+5pts"     icon="chart-bar"      />
            <KpiCard label="Lessons done"   value={progress?.completedLessons ?? '—'} deltaDir="up" delta="This term" icon="book-2"       />
            <KpiCard label="🔥 Streak"      value="12 days" deltaDir="up" delta="Personal best: 18" icon="flame"                           />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            {/* Subject progress */}
            <Card>
              <CardHeader title="This week's progress" action={<Link to="/parent/progress" className="text-[12px] font-medium text-[var(--product-accent)]">Full report →</Link>} />
              {['Mathematics','English Language','Basic Science','Social Studies'].map((sub, i) => {
                const pct = [80,65,90,55][i];
                return (
                  <div key={sub} className="flex items-center gap-3 py-3 border-b border-[var(--c-line-1)] last:border-0">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: subjectColor(sub) }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-medium text-[var(--c-ink-1)] mb-1">{sub}</div>
                      <ProgressBar value={pct} color={subjectColor(sub)} />
                    </div>
                    <div className="text-[13px] font-semibold text-[var(--c-ink-0)] w-8 text-right">{pct}%</div>
                  </div>
                );
              })}
            </Card>

            {/* Right column */}
            <div className="space-y-4">
              {/* Dinner conversation */}
              <Card>
                <CardHeader title="Dinner conversation starter" action="New question" />
                <div
                  className="p-4 rounded-xl text-[13px] text-[var(--c-ink-1)] leading-relaxed italic"
                  style={{ background: 'var(--c-surface-3)', borderLeft: `3px solid ${color}` }}
                >
                  "{lesson
                    ? `Can you tell me one thing you learned about "${lesson.title}" today? Which part did you find most interesting?`
                    : `What was the most interesting thing you learned at school today?`}"
                </div>
                {lesson && (
                  <div className="text-[10px] text-[var(--c-ink-4)] mt-2 font-mono">Based on today's lesson: {lesson.subject}</div>
                )}
              </Card>

              {/* Badges */}
              <Card>
                <CardHeader title="Recent badges" action={<Link to="/parent/progress" className="text-[12px] font-medium text-[var(--product-accent)]">All badges →</Link>} />
                <div className="grid grid-cols-4 gap-2">
                  <BadgeCard emoji="⭐" name="Star Reader"  earned />
                  <BadgeCard emoji="🔥" name="Streak 7"     earned />
                  <BadgeCard emoji="🧮" name="Maths Pro"    earned />
                  <BadgeCard emoji="🏆" name="Top Scorer"   earned={false} />
                </div>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
