/**
 * src/modules/sims/ReportsClassView.jsx
 *
 * /app/teacher/reports/:classId/:term/:year
 *
 * One row per pupil with status pill + comment indicator + actions.
 * Teacher taps a pupil → goes to ReportEditor for that pupil.
 */

import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import * as reportsService from '@/services/reportsService';
import * as simsService from '@/services/simsService';

const TERM_LABEL = { term_1: 'Term 1', term_2: 'Term 2', term_3: 'Term 3' };

const STATUS_VARIANT = {
  draft: 'amber',
  pending_approval: 'gold',
  approved: 'green',
  published: 'green',
};
const STATUS_LABEL = {
  draft: 'Draft',
  pending_approval: 'Pending review',
  approved: 'Approved',
  published: 'Sent',
};

export function ReportsClassView() {
  const { classId, term, year } = useParams();
  const yearNum = parseInt(year, 10);
  const navigate = useNavigate();

  const { data: classes } = useQuery({
    queryKey: ['teacher', 'classes'],
    queryFn: () => simsService.getMyClasses(),
    staleTime: 5 * 60_000,
  });
  const cls = classes?.find((c) => c.id === classId);

  const { data: list, isLoading, error } = useQuery({
    queryKey: ['class-reports', classId, term, yearNum],
    queryFn: () => reportsService.listClassReports({ classId, term, year: yearNum }),
    enabled: !!(classId && term && yearNum),
    staleTime: 30_000,
  });

  return (
    <div className="max-w-[820px]">
      <div className="mb-s-5">
        <Link to="/app/teacher/reports" className="text-[13.5px] text-ink-3 hover:text-ink-1">← All classes</Link>
      </div>
      <h2 className="font-display text-display-2 text-ink-0">
        {cls?.name ?? 'Reports'}
      </h2>
      <p className="mt-s-2 font-mono text-meta text-ink-3 mb-s-7">
        {TERM_LABEL[term]} · {yearNum}
      </p>

      {isLoading && <Skeleton />}
      {error && (
        <Card className="border-red-400/30 bg-red-400/[0.04]">
          <div className="text-red-400">{error.message}</div>
        </Card>
      )}
      {list && (
        <div className="bg-surface-2 border border-line-1 rounded-r-3 overflow-hidden">
          {list.map(({ pupil, report }) => (
            <PupilReportRow
              key={pupil.id}
              pupil={pupil}
              report={report}
              onOpen={() => navigate(`/app/teacher/reports/${classId}/${term}/${yearNum}/pupil/${pupil.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PupilReportRow({ pupil, report, onOpen }) {
  const status = report?.status ?? 'not_started';
  const initials = pupil.full_name.split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('') || '?';

  return (
    <button
      onClick={onOpen}
      className="w-full text-left border-b border-line-1 last:border-0 flex items-center gap-s-4 px-s-4 py-s-3 min-h-[64px] hover:bg-surface-3 transition-colors"
    >
      {pupil.photo_url ? (
        <img src={pupil.photo_url} alt="" className="w-[40px] h-[40px] rounded-full object-cover bg-surface-3 shrink-0" />
      ) : (
        <div className="w-[40px] h-[40px] rounded-full bg-gold-400/10 border border-gold-400/25 grid place-items-center font-mono text-[12px] text-gold-200 shrink-0">
          {initials}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-[14.5px] text-ink-1 truncate">{pupil.full_name}</div>
        <div className="font-mono text-[10px] text-ink-3 tracking-[0.06em] truncate">
          {pupil.pupil_code}
        </div>
      </div>
      {status === 'not_started' ? (
        <Chip variant="default">Not started</Chip>
      ) : (
        <Chip variant={STATUS_VARIANT[status] ?? 'default'} dot>
          {STATUS_LABEL[status] ?? status}
        </Chip>
      )}
      <span className="text-ink-3 ml-s-2">→</span>
    </button>
  );
}

function Skeleton() {
  return (
    <div className="space-y-s-2">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-[64px] bg-surface-2 rounded-r-2 animate-pulse" />
      ))}
    </div>
  );
}
