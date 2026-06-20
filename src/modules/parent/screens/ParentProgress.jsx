/**
 * ParentProgress.jsx — Full term progress report for parent
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import {
  PageHeader, Card, CardHeader, KpiCard, Chip, Button,
  ProgressBar, LoadingScreen, Empty, Divider, Tabs, StatRow,
} from '@/components/ui';

const TABS = [
  { key: 'subjects',   label: 'Subjects'    },
  { key: 'attendance', label: 'Attendance'  },
  { key: 'lessons',    label: 'Lessons'     },
  { key: 'badges',     label: 'Badges'      },
];

const SUBJECTS = [
  { name:'Mathematics',        score:72, grade:'C+', color:'#e5a62a' },
  { name:'English Language',   score:85, grade:'B',  color:'#3b82f6' },
  { name:'Basic Science',      score:91, grade:'A',  color:'#3fb950' },
  { name:'Social Studies',     score:68, grade:'C',  color:'#22b8a6' },
  { name:'CRS',                score:88, grade:'B+', color:'#f97066' },
];

const ALL_BADGES = [
  { e:'⭐', name:'Star Reader',  desc:'Read 10 lessons',       earned:true  },
  { e:'🔥', name:'On Fire',     desc:'7-day streak',           earned:true  },
  { e:'🧮', name:'Maths Pro',   desc:'Score 90%+ in Maths',   earned:true  },
  { e:'📚', name:'Bookworm',    desc:'Complete 20 lessons',    earned:true  },
  { e:'🌟', name:'All Rounder', desc:'All subjects done',      earned:true  },
  { e:'🏆', name:'Top Scorer',  desc:'Class rank #1',          earned:false },
  { e:'🚀', name:'Speed Reader',desc:'5 lessons in 1 day',     earned:false },
  { e:'💡', name:'Quiz Whiz',   desc:'10 perfect quizzes',     earned:false },
];

function useChildren(parentId) {
  return useQuery({
    queryKey: ['parent-children', parentId],
    queryFn: async () => {
      if (!parentId) return [];
      const { data } = await supabase.from('pupils')
        .select('id,first_name,last_name,classes(name)')
        .eq('parent_id', parentId);
      return data ?? [];
    },
    enabled: !!parentId,
  });
}

export default function ParentProgress() {
  const { profile }  = useAuth();
  const [tab, setTab]             = useState('subjects');
  const [activeChildIdx, setIdx]  = useState(0);

  const { data: children = [], isLoading } = useChildren(profile?.id);
  const child = children[activeChildIdx];

  if (isLoading) return <LoadingScreen />;

  return (
    <div>
      <PageHeader
        eyebrow="Parent"
        title="Progress report"
        subtitle={child ? `${child.first_name} ${child.last_name} · ${child.classes?.name} · Term 3` : 'Term 3 2025/2026'}
      >
        <Button variant="ghost" icon="download">Download PDF</Button>
      </PageHeader>

      {/* Child selector */}
      {children.length > 1 && (
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          {children.map((c, i) => (
            <button key={c.id} onClick={() => setIdx(i)}
              className="shrink-0 px-4 py-2 rounded-full text-[13px] font-semibold transition-all"
              style={{
                background: i===activeChildIdx?'rgba(251,113,133,0.15)':'var(--c-surface-3)',
                color:      i===activeChildIdx?'var(--product-accent)':'var(--c-ink-3)',
                border:     `1px solid ${i===activeChildIdx?'var(--product-accent)':'transparent'}`,
              }}>
              {c.first_name}
            </button>
          ))}
        </div>
      )}

      {!child ? (
        <Empty icon="users" message="No children linked. Add a child to see progress." />
      ) : (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <KpiCard label="Lesson completion" value="87%" deltaDir="up"   delta="+12% this term"  icon="book-2"       />
            <KpiCard label="Average score"     value="76%" deltaDir="up"   delta="+5pts"            icon="chart-bar"    />
            <KpiCard label="Attendance"        value="94%" deltaDir="flat" delta="23/24 days"       icon="calendar-stats"/>
            <KpiCard label="Badges earned"     value="5"   deltaDir="up"   delta="3 this week"      icon="trophy"       />
          </div>

          <Tabs tabs={TABS} active={tab} onChange={setTab} />

          {/* Subjects tab */}
          {tab === 'subjects' && (
            <div className="grid lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader title="Subject performance" />
                {SUBJECTS.map(s => (
                  <div key={s.name} className="flex items-center gap-3 py-3 border-b border-[var(--c-line-1)] last:border-0">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[13px] font-medium text-[var(--c-ink-1)]">{s.name}</span>
                        <span className="text-[12px] font-bold text-[var(--c-ink-0)]">{s.score}%</span>
                      </div>
                      <ProgressBar value={s.score} color={s.color} />
                    </div>
                    <Chip variant={s.score>=80?'green':s.score>=70?'teal':s.score>=60?'amber':'red'} size="sm">
                      {s.grade}
                    </Chip>
                  </div>
                ))}
              </Card>

              <Card>
                <CardHeader title="Learning streak" />
                <div className="text-center py-6">
                  <div className="text-[56px] font-heading font-bold" style={{ color: 'var(--product-accent)' }}>🔥 12</div>
                  <div className="text-[15px] text-[var(--c-ink-2)] mt-2">Day streak</div>
                  <div className="text-[12px] text-[var(--c-ink-4)] mt-1">Personal best: 18 days</div>
                </div>
                <Divider />
                <div className="mt-4">
                  <StatRow label="Lessons completed"     value="58"  />
                  <StatRow label="Total time learning"   value="24h" />
                  <StatRow label="Quizzes attempted"     value="32"  />
                  <StatRow label="Perfect quiz scores"   value="8"   color="var(--c-green-400)" />
                </div>
              </Card>
            </div>
          )}

          {/* Attendance tab */}
          {tab === 'attendance' && (
            <div className="grid lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader title="Term attendance" />
                <div className="text-center py-6">
                  <div className="font-heading text-[56px] font-bold text-[var(--c-ink-0)]">94%</div>
                  <ProgressBar value={94} color="var(--c-green-400)" className="mt-3 mx-8" />
                  <div className="text-[13px] text-[var(--c-ink-3)] mt-3">23 of 24 school days attended</div>
                </div>
                <Divider />
                <StatRow label="Present" value="23" color="var(--c-green-400)"  />
                <StatRow label="Absent"  value="1"  color="var(--c-red-400)"    />
                <StatRow label="Late"    value="0"                               />
              </Card>
              <Card>
                <CardHeader title="Attendance calendar" />
                <Empty icon="calendar-check" message="Monthly attendance calendar view coming soon." />
              </Card>
            </div>
          )}

          {/* Lessons tab */}
          {tab === 'lessons' && (
            <Card>
              <CardHeader title="Recent lesson activity" />
              {['Plants and Their Parts','Multiplication Tables','My Community','Parts of Speech','The Good Samaritan'].map((l,i) => (
                <div key={l} className="flex items-center gap-3 py-3 border-b border-[var(--c-line-1)] last:border-0">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[16px]"
                    style={{ background: 'rgba(251,113,133,0.12)' }}>📖</div>
                  <div className="flex-1">
                    <div className="text-[13px] font-medium text-[var(--c-ink-1)]">{l}</div>
                    <div className="text-[11px] text-[var(--c-ink-3)] mt-0.5">{['Today','Yesterday','2 days ago','3 days ago','4 days ago'][i]}</div>
                  </div>
                  <Chip variant="green" size="sm">Done</Chip>
                </div>
              ))}
            </Card>
          )}

          {/* Badges tab */}
          {tab === 'badges' && (
            <Card>
              <CardHeader title={`Badges · ${ALL_BADGES.filter(b=>b.earned).length} earned`} />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {ALL_BADGES.map(b => (
                  <div key={b.name}
                    className="text-center p-4 rounded-xl transition-all"
                    style={{
                      background: b.earned?'rgba(251,113,133,0.08)':'var(--c-surface-3)',
                      border:`1px solid ${b.earned?'rgba(251,113,133,0.2)':'transparent'}`,
                    }}>
                    <div className="text-[32px] mb-2" style={{ opacity: b.earned?1:0.2 }}>{b.e}</div>
                    <div className="text-[12px] font-bold" style={{ color: b.earned?'var(--c-ink-0)':'var(--c-ink-4)' }}>{b.name}</div>
                    <div className="text-[10px] text-[var(--c-ink-4)] mt-1">{b.desc}</div>
                    {b.earned && <Chip variant="rose" size="sm" className="mt-2">Earned</Chip>}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
