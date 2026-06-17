/**
 * StudentApp.jsx — Full student experience
 * Today · Roadmap · Library · Badges · Profile · Lesson viewer (full screen)
 */

import { useState } from 'react';
import { Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { AppShell } from '@/components/layout/AppShell';
import { ProductTheme } from '@/components/layout/ProductThemeProvider';
import LessonViewer from '@/components/lesson/LessonViewer';
import {
  PageHeader, Card, CardHeader, KpiCard, Chip, Button,
  ProgressBar, LoadingScreen, Empty, Tabs, StatRow, Divider, Avatar,
} from '@/components/ui';

const NAV = [
  { to:'/student',         end:true, icon:'home',   label:'Today'   },
  { to:'/student/roadmap', icon:'map',              label:'Roadmap' },
  { to:'/student/library', icon:'books',            label:'Library' },
  { to:'/student/badges',  icon:'trophy',           label:'Badges'  },
  { to:'/student/profile', icon:'user',             label:'Profile' },
];

const SUBJECT_COLORS = {
  'Mathematics':        '#e5a62a',
  'English Language':   '#3b82f6',
  'Basic Science':      '#3fb950',
  'Social Studies':     '#22b8a6',
  'CRS':                '#f97066',
  'Cultural & Creative Arts': '#7c3aed',
  'Physical & Health Education': '#fb7185',
};
const subColor = sub => SUBJECT_COLORS[sub] ?? '#7c3aed';

// ── Today ─────────────────────────────────────────────────────────────────────
const TODAY_LESSONS = [
  { id:'l1', sub:'Mathematics',      topic:'Multiplication Tables',   done:true,   color:'#e5a62a' },
  { id:'l2', sub:'English Language', topic:'Reading — My Family',     done:true,   color:'#3b82f6' },
  { id:'l3', sub:'Basic Science',    topic:'Plants and Their Parts',  active:true, color:'#3fb950', progress:50 },
  { id:'l4', sub:'Social Studies',   topic:'Community Helpers',       done:false,  color:'#22b8a6' },
  { id:'l5', sub:'CRS',              topic:'The Good Samaritan',      done:false,  color:'#f97066' },
];

function StudentToday() {
  const { profile } = useAuth();
  const done  = TODAY_LESSONS.filter(l => l.done).length;
  const total = TODAY_LESSONS.length;
  const pct   = Math.round((done / total) * 100);

  return (
    <div>
      <PageHeader
        eyebrow={`Student · ${profile?.class_name ?? 'Primary 2A'}`}
        title={`Ready to learn, ${profile?.first_name ?? 'Chidi'}? 🌟`}
        subtitle={`${new Date().toLocaleDateString('en-NG',{weekday:'long'})} · ${total - done} lesson${total-done!==1?'s':''} left today`}
      />

      {/* Progress hero */}
      <div className="p-5 rounded-2xl mb-5"
        style={{background:'linear-gradient(135deg,rgba(249,112,102,0.12),rgba(229,166,42,0.06))',border:'1px solid rgba(249,112,102,0.2)'}}>
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] mb-2" style={{color:'var(--c-coral-400)'}}>Today's progress</div>
        <div className="flex items-end justify-between mb-3">
          <div className="font-heading text-[32px] font-bold text-[var(--c-ink-0)]">{done}/{total}</div>
          <div className="text-[13px] text-[var(--c-ink-3)]">lessons done</div>
        </div>
        <ProgressBar value={pct} color="var(--c-coral-400)" />
      </div>

      {/* Continue hero */}
      {TODAY_LESSONS.find(l=>l.active) && (() => {
        const active = TODAY_LESSONS.find(l=>l.active);
        return (
          <div className="p-4 rounded-2xl mb-5 cursor-pointer hover:opacity-90 transition-opacity"
            style={{background:`linear-gradient(135deg,${active.color}15,${active.color}06)`,border:`1px solid ${active.color}30`}}>
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] mb-1.5" style={{color:active.color}}>Continue where you left off</div>
            <div className="font-heading text-[18px] font-bold text-[var(--c-ink-0)]">{active.topic}</div>
            <div className="text-[12px] text-[var(--c-ink-3)] mt-1">{active.sub} · {active.progress}% complete</div>
            <ProgressBar value={active.progress} color={active.color} className="mt-3" />
            <div className="flex items-center gap-3 mt-3">
              <Link to={`/student/lesson/${active.id}`}>
                <Button variant="primary" icon="player-play" style={{background:active.color,color:'#fff'}}>Continue</Button>
              </Link>
              <span className="text-[12px] text-[var(--c-ink-3)]">~{Math.round((100-active.progress)*0.25)} mins left</span>
            </div>
          </div>
        );
      })()}

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <KpiCard label="🔥 Streak" value="12 days" deltaDir="up" delta="Best: 18" />
        <KpiCard label="Badges"     value="8"       deltaDir="up" delta="+1 today"  />
        <KpiCard label="This week"  value="18/25"   deltaDir="up" delta="lessons"   />
      </div>

      {/* Lesson list */}
      <Card>
        <CardHeader title="Today's lessons" />
        <div className="space-y-2">
          {TODAY_LESSONS.map(l => (
            <div key={l.id}
              className="flex items-center gap-3 p-3 rounded-xl transition-all"
              style={{
                background: l.active ? `${l.color}10` : 'transparent',
                border: `1px solid ${l.active ? l.color+'30' : 'transparent'}`,
              }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[18px] shrink-0"
                style={{background:`${l.color}20`,color:l.color}}>
                {l.done ? '✅' : l.active ? '▶' : '📖'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-[var(--c-ink-0)] truncate">{l.topic}</div>
                <div className="text-[11px] text-[var(--c-ink-3)] mt-0.5">{l.sub}</div>
              </div>
              {l.done && <Chip variant="green" size="sm">Done ✓</Chip>}
              {l.active && (
                <Link to={`/student/lesson/${l.id}`}>
                  <Button variant="primary" size="sm" style={{background:l.color,color:'#fff'}}>Continue</Button>
                </Link>
              )}
              {!l.done && !l.active && <Chip variant="default" size="sm">🔒 Locked</Chip>}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── Roadmap ───────────────────────────────────────────────────────────────────
function StudentRoadmap() {
  const weeks = Array.from({length:13},(_,i)=>i+1);
  const currentWeek = 9;

  return (
    <div>
      <PageHeader eyebrow="Student" title="My roadmap" subtitle="Term 3 · 9 of 13 weeks complete" />
      <ProgressBar value={Math.round((currentWeek/13)*100)} className="mb-2" />
      <div className="text-[12px] text-[var(--c-ink-3)] mb-5">Week {currentWeek} of 13 · {Math.round((currentWeek/13)*100)}% complete</div>

      <div className="space-y-2">
        {weeks.map(w => {
          const done    = w < currentWeek;
          const current = w === currentWeek;
          const locked  = w > currentWeek;
          const lessonsInWeek = 5;
          const doneLessons   = done ? lessonsInWeek : current ? 3 : 0;

          return (
            <div key={w}
              className="flex items-center gap-3 p-3.5 rounded-xl transition-all"
              style={{
                background: current ? 'rgba(249,112,102,0.08)' : done ? 'rgba(63,185,80,0.04)' : 'transparent',
                border:     `1px solid ${current ? 'rgba(249,112,102,0.25)' : done ? 'rgba(63,185,80,0.15)' : 'var(--c-line-1)'}`,
              }}
            >
              {/* Week circle */}
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0"
                style={{
                  background: done ? 'var(--c-green-400)' : current ? 'var(--c-coral-400)' : 'var(--c-surface-4)',
                  color:      done || current ? '#fff' : 'var(--c-ink-4)',
                }}>
                {done ? '✓' : w}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[13px] font-semibold" style={{color:locked?'var(--c-ink-4)':'var(--c-ink-0)'}}>Week {w}</span>
                  {current && <Chip variant="coral" size="sm">Current week</Chip>}
                </div>
                {!locked && (
                  <div className="flex items-center gap-2">
                    <ProgressBar
                      value={Math.round((doneLessons/lessonsInWeek)*100)}
                      className="flex-1 max-w-[100px]"
                      color={done ? 'var(--c-green-400)' : 'var(--c-coral-400)'}
                    />
                    <span className="text-[11px] text-[var(--c-ink-4)]">{doneLessons}/{lessonsInWeek} lessons</span>
                  </div>
                )}
                {locked && <div className="text-[11px] text-[var(--c-ink-4)]">{lessonsInWeek} lessons · locked</div>}
              </div>

              {locked && <i className="ti ti-lock text-[var(--c-ink-4)] shrink-0" aria-hidden="true"/>}
              {done   && <Chip variant="green"  size="sm">Complete</Chip>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Library ───────────────────────────────────────────────────────────────────
function useLibraryLessons(pupilId) {
  return useQuery({
    queryKey: ['student-library', pupilId],
    queryFn: async () => {
      if (!pupilId) return [];
      // Get lessons for the student's class
      const { data: profile } = await supabase.from('pupils').select('class_id').eq('id', pupilId).single();
      if (!profile?.class_id) return [];

      const { data: lessons } = await supabase
        .from('lessons')
        .select('id,title,subject,week_number,term')
        .eq('class_id', profile.class_id)
        .order('term').order('week_number');

      const { data: progress } = await supabase
        .from('lesson_progress')
        .select('lesson_id,status')
        .eq('pupil_id', pupilId);

      const progMap = Object.fromEntries((progress??[]).map(p=>[p.lesson_id,p.status]));
      return (lessons??[]).map(l=>({...l,status:progMap[l.id]??'not_started'}));
    },
    enabled: !!pupilId,
    staleTime: 60_000,
  });
}

function StudentLibrary() {
  const { profile } = useAuth();
  const [subFilter, setSub] = useState('All');
  const [search, setSearch] = useState('');

  const { data: lessons = [], isLoading } = useLibraryLessons(profile?.id);

  const subjects = ['All', ...new Set(lessons.map(l=>l.subject))];

  const filtered = lessons.filter(l =>
    (subFilter==='All' || l.subject===subFilter) &&
    (!search || l.title.toLowerCase().includes(search.toLowerCase()))
  );

  const done        = lessons.filter(l=>l.status==='completed').length;
  const inProgress  = lessons.filter(l=>l.status==='in_progress').length;

  return (
    <div>
      <PageHeader eyebrow="Student" title="Lesson library" subtitle={`${lessons.length} lessons · ${done} completed`} />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <KpiCard label="Total lessons" value={lessons.length}  deltaDir="flat" />
        <KpiCard label="Completed"      value={done}           deltaDir="up" delta={`${Math.round((done/Math.max(lessons.length,1))*100)}%`} />
        <KpiCard label="In progress"    value={inProgress}     deltaDir="flat" />
      </div>

      {/* Filters */}
      <div className="mb-4 space-y-3">
        <input
          className="w-full max-w-[280px] bg-[var(--c-surface-3)] border border-[var(--c-line-2)] rounded-lg px-3 py-2.5 text-[13px] text-[var(--c-ink-1)] placeholder:text-[var(--c-ink-4)] outline-none focus:border-[var(--product-accent)] transition-colors"
          placeholder="Search lessons…"
          value={search}
          onChange={e=>setSearch(e.target.value)}
        />
        <div className="flex gap-1.5 flex-wrap">
          {subjects.map(s=>(
            <button key={s} onClick={()=>setSub(s)}
              className="px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all"
              style={{
                background: subFilter===s?(subColor(s)+'20'||'rgba(255,255,255,0.08)'):'var(--c-surface-3)',
                color:      subFilter===s?(subColor(s)||'var(--product-accent)'):'var(--c-ink-3)',
                border:     `1px solid ${subFilter===s?(subColor(s)+'50'||'var(--product-accent)'):'transparent'}`,
              }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? <LoadingScreen /> : filtered.length===0 ? (
        <Empty icon="books" message={lessons.length===0?'Your lessons will appear here once your class is set up.':'No lessons match your filters.'} />
      ) : (
        <div className="space-y-2">
          {filtered.map(l=>{
            const color = subColor(l.subject);
            const statusChip = l.status==='completed'
              ? <Chip variant="green" size="sm">Done ✓</Chip>
              : l.status==='in_progress'
              ? <Chip variant="teal"  size="sm">In progress</Chip>
              : <Chip variant="default" size="sm">Not started</Chip>;

            return (
              <div key={l.id}
                className="flex items-center gap-4 p-4 bg-[var(--c-surface-2)] border border-[var(--c-line-2)] rounded-xl hover:border-[var(--product-accent)] transition-colors group">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0"
                  style={{background:`${color}20`,color}}>
                  {l.status==='completed'?'✓':'📖'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-[var(--c-ink-0)] truncate">{l.title}</div>
                  <div className="text-[11px] text-[var(--c-ink-3)] mt-0.5">{l.subject} · Week {l.week_number} · Term {l.term}</div>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  {statusChip}
                  <Link to={`/student/lesson/${l.id}`}>
                    <Button variant="ghost" size="sm" icon={l.status==='completed'?'refresh':'player-play'}>
                      {l.status==='completed'?'Redo':'Start'}
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Badges ────────────────────────────────────────────────────────────────────
const ALL_BADGES = [
  {e:'⭐',name:'Star Reader',    desc:'Read 10 lessons',          earned:true,  earnedOn:'Mon 10 Jun' },
  {e:'🔥',name:'On Fire',        desc:'7-day streak',              earned:true,  earnedOn:'Thu 13 Jun' },
  {e:'🧮',name:'Maths Pro',      desc:'Score 90%+ in Maths',      earned:true,  earnedOn:'Wed 5 Jun'  },
  {e:'📚',name:'Bookworm',       desc:'Complete 20 lessons',       earned:true,  earnedOn:'Tue 4 Jun'  },
  {e:'🌟',name:'All Rounder',    desc:'All subjects in one day',   earned:true,  earnedOn:'Mon 3 Jun'  },
  {e:'🏆',name:'Top Scorer',     desc:'Class rank #1',             earned:false, earnedOn:null         },
  {e:'🚀',name:'Speed Reader',   desc:'5 lessons in 1 day',        earned:false, earnedOn:null         },
  {e:'💡',name:'Quiz Whiz',      desc:'10 perfect quiz scores',    earned:false, earnedOn:null         },
  {e:'🎯',name:'Bullseye',       desc:'100% on a quiz',            earned:false, earnedOn:null         },
  {e:'📅',name:'Consistent',     desc:'Study 5 days in a row',     earned:false, earnedOn:null         },
  {e:'🌍',name:'Explorer',       desc:'Complete all subjects',      earned:false, earnedOn:null         },
  {e:'🥇',name:'Gold Standard',  desc:'All A grades in a term',    earned:false, earnedOn:null         },
];

function StudentBadges() {
  const earned = ALL_BADGES.filter(b=>b.earned);
  const locked = ALL_BADGES.filter(b=>!b.earned);

  return (
    <div>
      <PageHeader eyebrow="Student" title="My badges" subtitle={`${earned.length} earned · ${locked.length} to unlock`} />

      {/* Streak hero */}
      <div className="p-5 rounded-2xl mb-5 text-center"
        style={{background:'linear-gradient(135deg,rgba(249,112,102,0.12),rgba(229,166,42,0.06))',border:'1px solid rgba(249,112,102,0.2)'}}>
        <div className="font-heading text-[48px] font-bold mb-1">🔥 12</div>
        <div className="text-[15px] text-[var(--c-ink-2)]">Day streak</div>
        <div className="text-[12px] text-[var(--c-ink-3)] mt-0.5">Personal best: 18 days · Keep going!</div>
      </div>

      {/* Earned */}
      <div className="mb-6">
        <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--c-ink-4)] mb-3">Earned ({earned.length})</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {earned.map(b=>(
            <div key={b.name}
              className="text-center p-4 rounded-xl"
              style={{background:'rgba(249,112,102,0.08)',border:'1px solid rgba(249,112,102,0.2)'}}>
              <div className="text-[36px] mb-2">{b.e}</div>
              <div className="text-[12px] font-bold text-[var(--c-ink-0)]">{b.name}</div>
              <div className="text-[10px] text-[var(--c-ink-4)] mt-1">{b.desc}</div>
              {b.earnedOn && <div className="text-[10px] font-mono text-[var(--c-coral-400)] mt-2">{b.earnedOn}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Locked */}
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--c-ink-4)] mb-3">To unlock ({locked.length})</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {locked.map(b=>(
            <div key={b.name}
              className="text-center p-4 rounded-xl"
              style={{background:'var(--c-surface-2)',border:'1px solid var(--c-line-1)'}}>
              <div className="text-[36px] mb-2 opacity-20">{b.e}</div>
              <div className="text-[12px] font-bold text-[var(--c-ink-4)]">{b.name}</div>
              <div className="text-[10px] text-[var(--c-ink-4)] mt-1">{b.desc}</div>
              <div className="text-[10px] text-[var(--c-ink-4)] mt-2">🔒 Locked</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Profile ───────────────────────────────────────────────────────────────────
function StudentProfile() {
  const { profile } = useAuth();
  const name = profile ? `${profile.first_name} ${profile.last_name}` : 'Student';

  return (
    <div>
      <PageHeader eyebrow="Student" title="My profile" />
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Profile card */}
        <Card className="text-center lg:col-span-1">
          <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center font-bold text-[22px] mb-3"
            style={{background:'rgba(249,112,102,0.2)',color:'var(--c-coral-400)'}}>
            {name.split(' ').map(n=>n[0]).join('').slice(0,2)}
          </div>
          <div className="font-heading font-bold text-[18px] text-[var(--c-ink-0)]">{name}</div>
          <div className="text-[12px] text-[var(--c-ink-3)] mt-1">Primary 2A · TLF Lekki Academy</div>
          <Divider className="my-4" />
          <StatRow label="🔥 Streak"          value="12 days"  />
          <StatRow label="Lessons completed"   value="58"       />
          <StatRow label="Badges earned"       value="5"        />
          <StatRow label="Average score"       value="76%"      />
          <StatRow label="Attendance"          value="94%"      />
        </Card>

        {/* Stats */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader title="Subject progress — Term 3" />
            {Object.entries(SUBJECT_COLORS).slice(0,5).map(([sub,color],i)=>{
              const pcts = [82,74,91,68,88];
              return (
                <div key={sub} className="flex items-center gap-3 py-2.5 border-b border-[var(--c-line-1)] last:border-0">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{background:color}} />
                  <div className="w-36 shrink-0 text-[12px] font-medium text-[var(--c-ink-1)] truncate">{sub}</div>
                  <div className="flex-1">
                    <ProgressBar value={pcts[i]} color={color} />
                  </div>
                  <div className="text-[12px] font-semibold text-[var(--c-ink-0)] w-8 text-right">{pcts[i]}%</div>
                </div>
              );
            })}
          </Card>

          <Card>
            <CardHeader title="Recent achievements" />
            {ALL_BADGES.filter(b=>b.earned).slice(0,3).map(b=>(
              <div key={b.name} className="flex items-center gap-3 py-2.5 border-b border-[var(--c-line-1)] last:border-0">
                <div className="text-[24px] shrink-0">{b.e}</div>
                <div className="flex-1">
                  <div className="text-[13px] font-semibold text-[var(--c-ink-0)]">{b.name}</div>
                  <div className="text-[11px] text-[var(--c-ink-3)]">{b.desc}</div>
                </div>
                <div className="text-[10px] font-mono text-[var(--c-coral-400)]">{b.earnedOn}</div>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}

// ── App root ──────────────────────────────────────────────────────────────────
export function StudentApp() {
  return (
    <ProductTheme surface="student">
      <Routes>
        {/* Full-screen lesson viewer — no AppShell chrome */}
        <Route path="lesson/:lessonId" element={<LessonViewer />} />
        {/* All other screens inside AppShell */}
        <Route path="*" element={
          <AppShell navItems={NAV} title="Student">
            <Routes>
              <Route index          element={<StudentToday />}   />
              <Route path="roadmap" element={<StudentRoadmap />} />
              <Route path="library" element={<StudentLibrary />} />
              <Route path="badges"  element={<StudentBadges />}  />
              <Route path="profile" element={<StudentProfile />} />
              <Route path="*"       element={<Navigate to="/student" replace />} />
            </Routes>
          </AppShell>
        } />
      </Routes>
    </ProductTheme>
  );
}
