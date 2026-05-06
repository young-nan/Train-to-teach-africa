/**
 * src/modules/sims/ScoresGradebookPicker.jsx
 *
 * Lands on /app/teacher/scores. Lets the teacher pick:
 *   - Which class
 *   - Which subject (free-text — schools differ on subject taxonomy)
 *   - Which term (term_1, term_2, term_3) and year
 *
 * Rather than separate dropdown steps, we use one card per class with
 * a small "subject + term" selector inline. For a teacher with 2 classes,
 * that's two cards on one screen — picking an existing gradebook is a
 * single tap, picking a new one is one tap + two selects + tap.
 */

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import * as simsService from '@/services/simsService';
import { cn } from '@/utils/cn';

// Schools converge on these subjects across Nursery/Primary in Nigeria.
// Teachers can still type a custom subject if their school uses something else.
const COMMON_SUBJECTS = [
  'Mathematics',
  'English Language',
  'Verbal Reasoning',
  'Quantitative Reasoning',
  'Basic Science',
  'Social Studies',
  'Civic Education',
  'Cultural & Creative Arts',
  'Christian Religious Studies',
  'Islamic Religious Studies',
  'French',
  'Yoruba',
  'Igbo',
  'Hausa',
  'Computer Studies',
  'Physical & Health Education',
  'Agricultural Science',
  'Home Economics',
];

const TERMS = [
  { code: 'term_1', label: 'Term 1' },
  { code: 'term_2', label: 'Term 2' },
  { code: 'term_3', label: 'Term 3' },
];

export function ScoresGradebookPicker() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: classes, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['teacher', 'classes'],
    queryFn: () => simsService.getMyClasses(),
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
  });

  // Slow-load timeout — same pattern as the attendance picker.
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!isLoading) { setSlow(false); return; }
    const t = setTimeout(() => setSlow(true), 8_000);
    return () => clearTimeout(t);
  }, [isLoading]);

  return (
    <div className="max-w-[820px]">
      <div className="mb-s-7">
        <div className="font-mono text-eyebrow uppercase text-gold-400">Gradebook</div>
        <h2 className="mt-s-3 font-display text-display-2 text-ink-0">
          Enter scores.
        </h2>
        <p className="mt-s-3 text-body text-ink-2 max-w-[58ch]">
          Pick a class and subject. The first time you open a term gradebook
          you'll set up its components (CA1, CA2, Exam). After that, you
          just enter scores.
        </p>
      </div>

      {isLoading && !slow && <SkeletonList />}
      {isLoading && slow && (
        <Card className="border-amber-400/30 bg-amber-400/[0.04]">
          <div className="font-display text-display-3 text-amber-400">Still loading…</div>
          <p className="mt-s-3 text-body text-ink-2">
            Network may be slow. Try again or refresh.
          </p>
          <div className="mt-s-5 flex gap-s-3">
            <Button intent="primary" size="sm" onClick={() => refetch()} isLoading={isFetching}>Try again</Button>
            <Button intent="ghost" size="sm" onClick={() => window.location.reload()}>Refresh</Button>
          </div>
        </Card>
      )}

      {error && (
        <Card className="border-red-400/30 bg-red-400/[0.04]">
          <div className="font-display text-display-3 text-red-400">Could not load classes</div>
          <p className="mt-s-3 text-body text-ink-2">{error.message}</p>
        </Card>
      )}

      {!isLoading && !error && classes?.length === 0 && (
        <Card>
          <div className="font-display text-display-3 text-ink-0">No classes yet.</div>
          <p className="mt-s-3 text-body text-ink-2">
            Your school administrator hasn't assigned you to any classes.
          </p>
        </Card>
      )}

      {classes?.length > 0 && (
        <div className="grid grid-cols-1 gap-s-4">
          {classes.map((cls) => (
            <ClassRow key={cls.id} cls={cls} navigate={navigate} />
          ))}
        </div>
      )}
    </div>
  );
}

function ClassRow({ cls, navigate }) {
  const currentYear = new Date().getFullYear();
  const [subject, setSubject] = useState(COMMON_SUBJECTS[0]);
  const [term, setTerm] = useState('term_1');
  const [year] = useState(currentYear);
  const [customMode, setCustomMode] = useState(false);
  const [customSubject, setCustomSubject] = useState('');

  const subjectToOpen = customMode ? customSubject.trim() : subject;
  const canOpen = subjectToOpen.length > 0;

  const open = () => {
    if (!canOpen) return;
    const params = new URLSearchParams({
      class_id: cls.id,
      subject: subjectToOpen,
      term,
      year: String(year),
    });
    navigate(`/app/teacher/scores/grid?${params}`);
  };

  return (
    <Card className="hover:border-gold-400/40 transition-colors duration-150">
      <div className="flex items-start justify-between gap-s-4 mb-s-5">
        <div className="min-w-0">
          <div className="font-mono text-eyebrow uppercase text-gold-400">{cls.level}</div>
          <h3 className="mt-s-2 font-display text-display-3 text-ink-0 truncate">{cls.name}</h3>
        </div>
        <Chip variant="default">{cls.pupil_count} pupils</Chip>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-s-3 mb-s-5">
        <Field label="Subject">
          {customMode ? (
            <input
              type="text"
              value={customSubject}
              onChange={(e) => setCustomSubject(e.target.value)}
              placeholder="Type subject name"
              className="bg-surface-3 border border-line-2 rounded-r-2 px-s-3 py-s-3 text-[14px] text-ink-1 outline-none focus:border-gold-400 w-full"
              autoFocus
            />
          ) : (
            <select
              value={subject}
              onChange={(e) => {
                if (e.target.value === '__custom__') {
                  setCustomMode(true);
                  setCustomSubject('');
                } else {
                  setSubject(e.target.value);
                }
              }}
              className="bg-surface-3 border border-line-2 rounded-r-2 px-s-3 py-s-3 text-[14px] text-ink-1 outline-none focus:border-gold-400 w-full"
            >
              {COMMON_SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
              <option value="__custom__">+ Other (type your own)</option>
            </select>
          )}
        </Field>
        <Field label="Term">
          <select
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            className="bg-surface-3 border border-line-2 rounded-r-2 px-s-3 py-s-3 text-[14px] text-ink-1 outline-none focus:border-gold-400 w-full"
          >
            {TERMS.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
          </select>
        </Field>
        <Field label="Year">
          <div className="bg-surface-3 border border-line-2 rounded-r-2 px-s-3 py-s-3 text-[14px] text-ink-1 w-full font-mono">
            {year}
          </div>
        </Field>
      </div>

      <div className="flex items-center justify-between gap-s-3 flex-wrap">
        {customMode && (
          <button
            onClick={() => setCustomMode(false)}
            className="text-[13px] text-ink-3 hover:text-ink-1 transition-colors"
          >
            ← Pick from list
          </button>
        )}
        <div className={cn('ml-auto', customMode && '')}>
          <Button intent="primary" size="md" onClick={open} disabled={!canOpen}>
            Open gradebook →
          </Button>
        </div>
      </div>
    </Card>
  );
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-s-2">
      <span className="font-mono text-meta uppercase tracking-[0.14em] text-ink-3">{label}</span>
      {children}
    </label>
  );
}

function SkeletonList() {
  return (
    <div className="grid grid-cols-1 gap-s-4">
      {[0, 1].map((i) => (
        <div key={i} className="bg-surface-2 border border-line-1 rounded-r-3 p-s-6 h-[200px] animate-pulse">
          <div className="h-[10px] w-[80px] bg-surface-3 rounded" />
          <div className="mt-s-4 h-[24px] w-[180px] bg-surface-3 rounded" />
          <div className="mt-s-7 grid grid-cols-3 gap-s-3">
            <div className="h-[44px] bg-surface-3 rounded" />
            <div className="h-[44px] bg-surface-3 rounded" />
            <div className="h-[44px] bg-surface-3 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
