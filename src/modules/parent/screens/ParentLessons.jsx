/**
 * ParentLessons.jsx — Parent lesson library
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import {
  PageHeader, Card, Chip, Button, ProgressBar,
  LoadingScreen, Empty, SegmentControl, Input,
} from '@/components/ui';

const SUBJECT_COLORS = {
  'Mathematics':      '#e5a62a',
  'English Language': '#3b82f6',
  'Basic Science':    '#3fb950',
  'Social Studies':   '#22b8a6',
  'CRS':              '#f97066',
};

function useChildren(parentId) {
  return useQuery({
    queryKey: ['parent-children', parentId],
    queryFn: async () => {
      if (!parentId) return [];
      const { data } = await supabase.from('pupils').select('id,first_name,classes(id,name)').eq('parent_id', parentId);
      return data ?? [];
    },
    enabled: !!parentId,
  });
}

function useLessons(classId) {
  return useQuery({
    queryKey: ['parent-lessons', classId],
    queryFn: async () => {
      if (!classId) return [];
      const { data } = await supabase
        .from('lessons')
        .select('id,title,subject,week_number,term')
        .eq('class_id', classId)
        .order('week_number');
      return data ?? [];
    },
    enabled: !!classId,
  });
}

const SUBJECTS = ['All','Mathematics','English Language','Basic Science','Social Studies','CRS'];

export default function ParentLessons() {
  const { profile }   = useAuth();
  const [childIdx, setChildIdx]   = useState(0);
  const [subFilter, setSubFilter] = useState('All');
  const [search, setSearch]       = useState('');

  const { data: children = [] }         = useChildren(profile?.id);
  const child = children[childIdx];
  const classId = child?.classes?.id;

  const { data: lessons = [], isLoading } = useLessons(classId);

  const filtered = lessons.filter(l => {
    const matchSub    = subFilter === 'All' || l.subject === subFilter;
    const matchSearch = !search || l.title.toLowerCase().includes(search.toLowerCase()) || l.subject.toLowerCase().includes(search.toLowerCase());
    return matchSub && matchSearch;
  });

  return (
    <div>
      <PageHeader
        eyebrow="Parent"
        title="Lesson library"
        subtitle={child ? `${child.classes?.name ?? '—'} curriculum · Term 3` : 'Select a child'}
      >
        <Button variant="ghost" icon="printer">Print lesson</Button>
      </PageHeader>

      {children.length > 1 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {children.map((c,i) => (
            <button key={c.id} onClick={() => setChildIdx(i)}
              className="shrink-0 px-4 py-2 rounded-full text-[13px] font-semibold transition-all"
              style={{
                background: i===childIdx?'rgba(251,113,133,0.15)':'var(--c-surface-3)',
                color:      i===childIdx?'var(--product-accent)':'var(--c-ink-3)',
                border:     `1px solid ${i===childIdx?'var(--product-accent)':'transparent'}`,
              }}>
              {c.first_name}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-5">
        <Input className="max-w-[220px]" placeholder="Search lessons…" value={search} onChange={e => setSearch(e.target.value)} />
        <div className="flex gap-1 flex-wrap">
          {SUBJECTS.map(s => (
            <button key={s} onClick={() => setSubFilter(s)}
              className="px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all"
              style={{
                background: subFilter===s?(SUBJECT_COLORS[s]?SUBJECT_COLORS[s]+'20':'rgba(255,255,255,0.08)'):'var(--c-surface-3)',
                color:      subFilter===s?(SUBJECT_COLORS[s]??'var(--product-accent)'):'var(--c-ink-3)',
                border:     `1px solid ${subFilter===s?(SUBJECT_COLORS[s]??'var(--product-accent)')+'40':'transparent'}`,
              }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <LoadingScreen />
      ) : filtered.length === 0 ? (
        <Empty icon="book-2" message={lessons.length === 0 ? 'No lessons available yet.' : 'No lessons match your filters.'} />
      ) : (
        <div className="space-y-2">
          {filtered.map(lesson => {
            const color = SUBJECT_COLORS[lesson.subject] ?? '#7c3aed';
            const done  = Math.random() > 0.5; // Replace with actual progress check
            return (
              <div key={lesson.id}
                className="flex items-center gap-4 p-4 bg-[var(--c-surface-2)] border border-[var(--c-line-2)] rounded-xl hover:border-[var(--product-accent)] transition-colors cursor-pointer group">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0"
                  style={{ background: `${color}20`, color }}>
                  {done ? '✓' : '📖'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-[var(--c-ink-0)] truncate">{lesson.title}</div>
                  <div className="text-[11px] text-[var(--c-ink-3)] mt-0.5">
                    {lesson.subject} · Week {lesson.week_number} · Term {lesson.term}
                  </div>
                </div>
                <div className="shrink-0">
                  {done
                    ? <Chip variant="green" size="sm">Done</Chip>
                    : <Button variant="ghost" size="sm" style={{ borderColor: color+'50', color }}>Start</Button>
                  }
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
