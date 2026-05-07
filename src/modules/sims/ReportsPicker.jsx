/**
 * src/modules/sims/ReportsPicker.jsx
 *
 * /app/teacher/reports — landing screen.
 *
 * Pick a class + term + year, see the per-pupil report status grid for
 * that combination. Mirrors the gradebook picker layout. From here the
 * teacher drills into a specific pupil's report for editing.
 */

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import * as simsService from '@/services/simsService';
import * as reportsService from '@/services/reportsService';

const TERMS = [
  { code: 'term_1', label: 'Term 1' },
  { code: 'term_2', label: 'Term 2' },
  { code: 'term_3', label: 'Term 3' },
];

const STATUS_VARIANT = {
  draft: 'amber',
  pending_approval: 'gold',
  approved: 'green',
  published: 'green',
  archived: 'default',
};

const STATUS_LABEL = {
  draft: 'Draft',
  pending_approval: 'Pending review',
  approved: 'Approved',
  published: 'Sent to parent',
  archived: 'Archived',
};

export function ReportsPicker() {
  const { user } = useAuth();
  const currentYear = new Date().getFullYear();
  const [term, setTerm] = useState('term_1');
  const [year] = useState(currentYear);

  const { data: classes, isLoading } = useQuery({
    queryKey: ['teacher', 'classes'],
    queryFn: () => simsService.getMyClasses(),
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
  });

  return (
    <div className="max-w-[820px]">
      <div className="mb-s-7">
        <div className="font-mono text-eyebrow uppercase text-gold-400">Term reports</div>
        <h2 className="mt-s-3 font-display text-display-2 text-ink-0">
          Generate report cards.
        </h2>
        <p className="mt-s-3 text-body text-ink-2 max-w-[58ch]">
          Pick a class to see this term's reports. You'll write per-pupil
          comments, conduct ratings, and submit for head-teacher review
          (or auto-publish, depending on your school's setup).
        </p>
      </div>

      {/* Term selector */}
      <div className="mb-s-7 flex items-center gap-s-3">
        <span className="font-mono text-eyebrow uppercase text-ink-3">Term</span>
        <div className="flex gap-s-2">
          {TERMS.map((t) => (
            <button
              key={t.code}
              onClick={() => setTerm(t.code)}
              className={
                term === t.code
                  ? 'px-s-4 py-[7px] rounded-full text-[12.5px] font-medium bg-gold-400 text-[#1a1305] border border-gold-400'
                  : 'px-s-4 py-[7px] rounded-full text-[12.5px] font-medium bg-surface-2 text-ink-2 border border-line-2 hover:border-line-3 hover:text-ink-1'
              }
            >
              {t.label}
            </button>
          ))}
        </div>
        <span className="ml-auto font-mono text-meta text-ink-3">Year {year}</span>
      </div>

      {isLoading && <SkeletonList />}
      {classes?.length === 0 && (
        <Card>
          <div className="font-display text-display-3 text-ink-0">No classes yet.</div>
        </Card>
      )}
      {classes?.length > 0 && (
        <div className="grid grid-cols-1 gap-s-4">
          {classes.map((cls) => (
            <ClassReportRow key={cls.id} cls={cls} term={term} year={year} />
          ))}
        </div>
      )}
    </div>
  );
}

function ClassReportRow({ cls, term, year }) {
  const navigate = useNavigate();
  const { data: list, isLoading } = useQuery({
    queryKey: ['class-reports', cls.id, term, year],
    queryFn: () => reportsService.listClassReports({ classId: cls.id, term, year }),
    staleTime: 60_000,
  });

  const counts = (list ?? []).reduce((acc, row) => {
    const s = row.report?.status ?? 'not_started';
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});
  const total = list?.length ?? 0;
  const ready = (counts.published ?? 0) + (counts.approved ?? 0);

  return (
    <Card className="hover:border-gold-400/40 transition-colors duration-150">
      <div className="flex items-start justify-between gap-s-4 mb-s-5">
        <div className="min-w-0">
          <div className="font-mono text-eyebrow uppercase text-gold-400">{cls.level}</div>
          <h3 className="mt-s-2 font-display text-display-3 text-ink-0 truncate">{cls.name}</h3>
        </div>
        <Chip variant="default">{cls.pupil_count} pupils</Chip>
      </div>

      {isLoading ? (
        <div className="h-[24px] w-[140px] bg-surface-3 rounded animate-pulse" />
      ) : (
        <div className="flex items-center gap-s-3 mb-s-5 flex-wrap">
          <span className="font-mono text-meta text-ink-2">
            {ready} of {total} ready
          </span>
          {counts.draft > 0 && <Chip variant="amber" dot>{counts.draft} draft</Chip>}
          {counts.pending_approval > 0 && <Chip variant="gold" dot>{counts.pending_approval} pending</Chip>}
          {counts.approved > 0 && <Chip variant="green" dot>{counts.approved} approved</Chip>}
          {counts.published > 0 && <Chip variant="green" dot>{counts.published} sent</Chip>}
          {(counts.not_started ?? 0) > 0 && (
            <Chip variant="default">{counts.not_started} not started</Chip>
          )}
        </div>
      )}

      <div className="flex justify-end">
        <Button
          intent="primary"
          size="md"
          onClick={() => navigate(`/app/teacher/reports/${cls.id}/${term}/${year}`)}
        >
          Open class →
        </Button>
      </div>
    </Card>
  );
}

function SkeletonList() {
  return (
    <div className="grid grid-cols-1 gap-s-4">
      {[0, 1].map((i) => (
        <div key={i} className="bg-surface-2 border border-line-1 rounded-r-3 p-s-6 h-[180px] animate-pulse" />
      ))}
    </div>
  );
}
