/**
 * AdminCurriculum.jsx — Curriculum management screen
 * Browse NERDC/NAPPS lessons · Track coverage · View scheme of work
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Icon } from '@/components/ui/Icon';
import {
  PageHeader, Card, CardHeader, KpiCard, Chip, Button,
  Select, Input, ProgressBar, LoadingScreen, Empty, Tabs,
} from '@/components/ui';

const SUBJECTS = [
  'Mathematics','English Language','Basic Science','Social Studies',
  'CRS','Islamic Studies','Cultural & Creative Arts',
  'Physical & Health Education','Vocational Aptitude',
];

const CLASS_LEVELS = ['Nursery 1','Nursery 2','Nursery 3','Primary 1','Primary 2','Primary 3','Primary 4','Primary 5','Primary 6'];

const CURRICULA = [
  { id:'nerdc', label:'NERDC 2025',  color:'#e5a62a' },
  { id:'napps', label:'NAPPS 2025',  color:'#22b8a6' },
  { id:'cambridge', label:'Cambridge', color:'#3b82f6' },
];

const TABS = [
  { key:'overview',  label:'Coverage overview' },
  { key:'lessons',   label:'Lesson browser'    },
  { key:'scheme',    label:'Scheme of work'    },
];

function useLessons(classLevel, subject, curriculum) {
  return useQuery({
    queryKey: ['admin-lessons', classLevel, subject, curriculum],
    queryFn: async () => {
      if (!classLevel) return [];
      let q = supabase
        .from('lessons')
        .select('id,title,subject,week_number,term,class_level,curriculum_type,objectives')
        .eq('class_level', classLevel)
        .order('term')
        .order('week_number');

      if (subject)    q = q.eq('subject', subject);
      if (curriculum) q = q.eq('curriculum_type', curriculum);

      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!classLevel,
    staleTime: 120_000,
  });
}

function CoverageBar({ label, done, total, color }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-[var(--c-line-1)] last:border-0">
      <div className="w-32 shrink-0 text-[12px] font-medium text-[var(--c-ink-1)] truncate">{label}</div>
      <div className="flex-1">
        <ProgressBar value={pct} color={color ?? 'var(--product-accent)'} />
      </div>
      <div className="text-[12px] font-semibold text-[var(--c-ink-0)] w-14 text-right">{done}/{total}</div>
      <Chip variant={pct >= 80 ? 'green' : pct >= 50 ? 'amber' : 'red'} size="sm">{pct}%</Chip>
    </div>
  );
}

function LessonRow({ lesson, onView }) {
  const termColors = { 1:'#3b82f6', 2:'#22b8a6', 3:'#e5a62a' };
  return (
    <div className="flex items-center gap-3 px-5 py-3 border-b border-[var(--c-line-1)] last:border-0 hover:bg-[var(--c-surface-3)] transition-colors">
      <div className="w-16 shrink-0 text-center">
        <div className="text-[10px] font-mono uppercase tracking-wide text-[var(--c-ink-4)]">Wk</div>
        <div className="text-[16px] font-bold text-[var(--c-ink-0)]">{lesson.week_number}</div>
      </div>
      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: termColors[lesson.term] ?? 'var(--product-accent)' }} />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-[var(--c-ink-0)] truncate">{lesson.title}</div>
        <div className="text-[11px] text-[var(--c-ink-3)] mt-0.5">{lesson.subject} · Term {lesson.term}</div>
      </div>
      <Chip variant="default" size="sm">{lesson.curriculum_type ?? 'NERDC'}</Chip>
      <Button variant="ghost" size="sm" icon="eye" onClick={() => onView?.(lesson)}>View</Button>
    </div>
  );
}

function SchemeWeek({ week, term, lessons }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-[var(--c-line-2)] rounded-xl overflow-hidden mb-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 p-4 hover:bg-[var(--c-surface-3)] transition-colors"
      >
        <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-[14px] shrink-0"
          style={{ background: 'var(--product-accent)', color: '#1a1305' }}>
          {week}
        </div>
        <div className="flex-1 text-left">
          <div className="text-[13px] font-semibold text-[var(--c-ink-0)]">Week {week} · Term {term}</div>
          <div className="text-[11px] text-[var(--c-ink-3)] mt-0.5">{lessons.length} lesson{lessons.length !== 1 ? 's' : ''}</div>
        </div>
        <Icon name={`chevron-${open ? 'up' : 'down'}`} className="text-[var(--c-ink-3)]" />
      </button>
      {open && (
        <div className="border-t border-[var(--c-line-1)]">
          {lessons.map(l => (
            <div key={l.id} className="flex items-center gap-3 px-4 py-3 border-b border-[var(--c-line-1)] last:border-0 hover:bg-[var(--c-surface-2)] transition-colors">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: 'var(--product-accent)' }} />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-[var(--c-ink-1)] truncate">{l.title}</div>
                <div className="text-[11px] text-[var(--c-ink-3)]">{l.subject}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminCurriculum() {
  
  const [tab,        setTab]       = useState('overview');
  const [classLevel, setClass]     = useState('');
  const [subject,    setSubject]   = useState('');
  const [curriculum, setCurriculum]= useState('');
  const [search,     setSearch]    = useState('');
  const [previewLesson, setPreview]= useState(null);

  const { data: lessons = [], isLoading } = useLessons(classLevel, subject, curriculum);

  const filtered = lessons.filter(l =>
    !search || l.title.toLowerCase().includes(search.toLowerCase()) || l.subject.toLowerCase().includes(search.toLowerCase())
  );

  // Group by week for scheme of work
  const byWeek = {};
  filtered.forEach(l => {
    const key = `${l.term}_${l.week_number}`;
    if (!byWeek[key]) byWeek[key] = { term: l.term, week: l.week_number, lessons: [] };
    byWeek[key].lessons.push(l);
  });
  const weekGroups = Object.values(byWeek).sort((a,b) => a.term - b.term || a.week - b.week);

  // Coverage mock (replace with real counts)
  const coverageData = SUBJECTS.map(s => ({
    label: s,
    done:  Math.floor(Math.random() * 13),
    total: 13,
  }));

  return (
    <div>
      <PageHeader
        eyebrow="Admin"
        title="Curriculum"
        subtitle="NERDC / NAPPS 2025-aligned lessons and scheme of work."
      >
        <Button variant="ghost" icon="download">Download scheme of work</Button>
      </PageHeader>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Total lessons"   value={lessons.length || '—'} deltaDir="flat" icon="book-2"     />
        <KpiCard label="Subjects"        value={SUBJECTS.length}        deltaDir="flat" icon="layers"     />
        <KpiCard label="Terms covered"   value="3"                      deltaDir="flat" icon="calendar"   />
        <KpiCard label="Curricula"       value="NERDC · NAPPS"          deltaDir="flat" icon="certificate"/>
      </div>

      {/* Curriculum filter pills */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {CURRICULA.map(c => (
          <button
            key={c.id}
            onClick={() => setCurriculum(curriculum === c.id ? '' : c.id)}
            className="px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all"
            style={{
              background: curriculum === c.id ? `${c.color}20` : 'var(--c-surface-3)',
              color:      curriculum === c.id ? c.color : 'var(--c-ink-3)',
              border:     `1px solid ${curriculum === c.id ? c.color + '50' : 'transparent'}`,
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {/* ── Coverage overview ── */}
      {tab === 'overview' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader title="Subject coverage — Primary 2A" action="Change class" />
            {coverageData.slice(0, 6).map(s => (
              <CoverageBar key={s.label} label={s.label} done={s.done} total={s.total} color="var(--product-accent)" />
            ))}
          </Card>
          <Card>
            <CardHeader title="Term progress" />
            {[1, 2, 3].map(term => {
              const termLessons = lessons.filter(l => l.term === term);
              const pct = termLessons.length ? Math.min(100, Math.round((term === 1 ? 100 : term === 2 ? 85 : 69))) : 0;
              return (
                <div key={term} className="py-4 border-b border-[var(--c-line-1)] last:border-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[13px] font-medium text-[var(--c-ink-1)]">Term {term}</span>
                    <span className="text-[13px] font-bold text-[var(--c-ink-0)]">{pct}%</span>
                  </div>
                  <ProgressBar
                    value={pct}
                    color={pct >= 80 ? 'var(--c-green-400)' : pct >= 50 ? 'var(--product-accent)' : 'var(--c-sky-400)'}
                  />
                  <div className="text-[11px] text-[var(--c-ink-3)] mt-1">
                    {term === 3 ? 'In progress' : term === 2 ? 'Complete' : 'Complete'}
                  </div>
                </div>
              );
            })}
          </Card>
        </div>
      )}

      {/* ── Lesson browser ── */}
      {tab === 'lessons' && (
        <>
          <div className="flex flex-wrap gap-3 mb-4">
            <Select className="max-w-[180px]" value={classLevel} onChange={e => setClass(e.target.value)}>
              <option value="">All class levels</option>
              {CLASS_LEVELS.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
            <Select className="max-w-[220px]" value={subject} onChange={e => setSubject(e.target.value)}>
              <option value="">All subjects</option>
              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
            <Input className="max-w-[240px]" placeholder="Search lessons…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {isLoading ? <LoadingScreen /> : filtered.length === 0 ? (
            <Empty icon="book-2" message={classLevel ? 'No lessons found for this selection.' : 'Select a class level to browse lessons.'} />
          ) : (
            <Card padding={false}>
              {filtered.map(l => <LessonRow key={l.id} lesson={l} onView={setPreview} />)}
            </Card>
          )}
        </>
      )}

      {/* ── Scheme of work ── */}
      {tab === 'scheme' && (
        <>
          <div className="flex flex-wrap gap-3 mb-4">
            <Select className="max-w-[180px]" value={classLevel} onChange={e => setClass(e.target.value)}>
              <option value="">Select class level…</option>
              {CLASS_LEVELS.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
            <Select className="max-w-[220px]" value={subject} onChange={e => setSubject(e.target.value)}>
              <option value="">All subjects</option>
              {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>

          {!classLevel ? (
            <Card>
              <div className="py-10 text-center text-[13px] text-[var(--c-ink-3)]">Select a class level to view scheme of work.</div>
            </Card>
          ) : isLoading ? (
            <LoadingScreen />
          ) : weekGroups.length === 0 ? (
            <Empty icon="calendar" message="No lessons found for this selection." />
          ) : (
            <div>
              {weekGroups.map(wg => (
                <SchemeWeek key={`${wg.term}_${wg.week}`} week={wg.week} term={wg.term} lessons={wg.lessons} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Lesson preview modal */}
      {previewLesson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setPreview(null)} />
          <div className="relative w-full max-w-[560px] bg-[var(--c-surface-2)] border border-[var(--c-line-2)] rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--c-line-1)]">
              <div>
                <div className="font-heading font-bold text-[16px] text-[var(--c-ink-0)]">{previewLesson.title}</div>
                <div className="text-[11px] text-[var(--c-ink-3)] mt-0.5">{previewLesson.subject} · Week {previewLesson.week_number} · Term {previewLesson.term}</div>
              </div>
              <button onClick={() => setPreview(null)} className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--c-ink-3)] hover:bg-[var(--c-surface-3)] transition-colors">
                <Icon name="x" className="text-[18px]" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {previewLesson.objectives && (
                <div>
                  <div className="text-[11px] font-mono uppercase tracking-[0.1em] text-[var(--c-ink-3)] mb-2">Learning objectives</div>
                  <p className="text-[13px] text-[var(--c-ink-1)] leading-relaxed">{previewLesson.objectives}</p>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <Button variant="primary" icon="external-link">Open lesson</Button>
                <Button variant="ghost" icon="download">Download PDF</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
