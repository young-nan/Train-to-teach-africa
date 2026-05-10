/**
 * src/modules/parent/ParentReportsView.jsx
 *
 * /app/parent/reports
 *
 * Lists the parent's children. For each child, shows their published
 * reports as cards with: term, year, overall grade, and a "View report"
 * button that opens the print preview in a new tab.
 *
 * Only PUBLISHED reports are visible to parents — drafts and pending
 * reports are filtered out by RLS in the reportsService layer.
 *
 * If the parent has multiple children, each gets its own section. Most
 * Nigerian families have 2-4 children at the same school, so this scales
 * naturally.
 */

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import * as simsService from '@/services/simsService';
import * as reportsService from '@/services/reportsService';

const TERM_LABEL = {
  term_1: 'First Term',
  term_2: 'Second Term',
  term_3: 'Third Term',
};

export function ParentReportsView() {
  const { data: children, isLoading, error } = useQuery({
    queryKey: ['parent', 'children'],
    queryFn: () => simsService.getMyChildren(),
    staleTime: 5 * 60_000,
  });

  return (
    <div className="max-w-[820px]">
      <div className="mb-s-7">
        <div className="font-mono text-eyebrow uppercase text-gold-400">Reports</div>
        <h2 className="mt-s-3 font-display text-display-2 text-ink-0">
          Term reports.
        </h2>
        <p className="mt-s-3 text-body text-ink-2 max-w-[58ch]">
          End-of-term report cards for your children. New reports appear
          here as soon as the school publishes them.
        </p>
      </div>

      {isLoading && <Skeleton />}

      {error && (
        <Card className="border-red-400/30 bg-red-400/[0.04]">
          <div className="font-display text-display-3 text-red-400">Couldn't load</div>
          <p className="mt-s-3 text-body text-ink-2">{error.message}</p>
        </Card>
      )}

      {children?.length === 0 && (
        <Card>
          <div className="font-display text-display-3 text-ink-0">No children linked yet.</div>
          <p className="mt-s-3 text-body text-ink-2">
            Your school administrator hasn't linked your account to a pupil
            yet. Once they do, your children's reports will appear here.
          </p>
        </Card>
      )}

      {children?.length > 0 && (
        <div className="space-y-s-7">
          {children.map((child) => (
            <ChildReportsSection key={child.id} child={child} />
          ))}
        </div>
      )}
    </div>
  );
}

function ChildReportsSection({ child }) {
  const { data: reports, isLoading } = useQuery({
    queryKey: ['parent', 'reports', child.id],
    queryFn: () => reportsService.listParentReports({ pupilId: child.id }),
    staleTime: 60_000,
  });

  return (
    <section>
      <div className="flex items-center gap-s-4 mb-s-4">
        <ChildAvatar child={child} />
        <div className="flex-1 min-w-0">
          <div className="font-mono text-eyebrow uppercase text-gold-400">
            {child.classes?.name ?? child.level?.replace('_', ' ')}
          </div>
          <h3 className="font-display text-display-3 text-ink-0 truncate">{child.full_name}</h3>
        </div>
      </div>

      {isLoading && (
        <div className="bg-surface-2 border border-line-1 rounded-r-3 p-s-6 h-[120px] animate-pulse" />
      )}

      {reports?.length === 0 && (
        <Card>
          <p className="text-[13.5px] text-ink-2">
            No published reports yet. End-of-term reports appear here once
            the school publishes them.
          </p>
        </Card>
      )}

      {reports?.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-s-4">
          {reports.map((r) => (
            <ReportCardTile key={r.id} report={r} childId={child.id} />
          ))}
        </div>
      )}
    </section>
  );
}

function ReportCardTile({ report, childId }) {
  const printHref = `/app/parent/reports/${childId}/${report.term}/${report.year}/print`;
  const presentPct = report.attendance_present_pct;
  const overall = report.overall_average;

  return (
    <Card className="hover:border-gold-400/40 transition-colors duration-150">
      <div className="flex items-start justify-between gap-s-4 mb-s-5">
        <div>
          <div className="font-display text-display-3 text-ink-0">
            {TERM_LABEL[report.term] ?? report.term}
          </div>
          <div className="font-mono text-meta text-ink-3 mt-s-1">
            Academic year {report.year}/{report.year + 1}
          </div>
        </div>
        <Chip variant="green" dot>Published</Chip>
      </div>

      <div className="flex items-center gap-s-7 mb-s-5">
        {overall != null && (
          <Stat label="Overall" value={`${Math.round(overall)}%`} />
        )}
        {presentPct != null && (
          <Stat label="Attendance" value={`${Math.round(presentPct)}%`} />
        )}
      </div>

      <a href={printHref} target="_blank" rel="noopener noreferrer">
        <Button intent="primary" size="md" className="w-full justify-center">
          View report →
        </Button>
      </a>
    </Card>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="font-mono text-meta uppercase tracking-[0.14em] text-ink-3">{label}</div>
      <div className="text-[20px] leading-none text-ink-0 font-display tabular-nums mt-s-1">{value}</div>
    </div>
  );
}

function ChildAvatar({ child }) {
  if (child.photo_url) {
    return (
      <img
        src={child.photo_url}
        alt=""
        className="w-[56px] h-[56px] rounded-full object-cover bg-surface-3 shrink-0"
        loading="lazy"
      />
    );
  }
  const initials = child.full_name.split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('') || '?';
  return (
    <div className="w-[56px] h-[56px] rounded-full bg-gold-400/10 border border-gold-400/30 grid place-items-center font-mono text-[16px] text-gold-200 shrink-0">
      {initials}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-s-5">
      {[0, 1].map((i) => (
        <div key={i} className="bg-surface-2 border border-line-1 rounded-r-3 p-s-6 h-[180px] animate-pulse" />
      ))}
    </div>
  );
}
