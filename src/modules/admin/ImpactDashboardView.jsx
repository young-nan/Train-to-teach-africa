/**
 * src/modules/admin/ImpactDashboardView.jsx
 *
 * /app/admin/impact
 *
 * Two modes based on role:
 *   school_admin  → sees their own school's metrics + "vs network" benchmarks
 *   super_admin   → sees all schools in a league table + network aggregates
 *
 * SECTIONS
 * ────────
 * 1. Hero KPI band      — 6 top-line metrics with trend indicators
 * 2. Trend chart        — 12-week attendance + parent engagement sparklines
 * 3. Network comparison — how this school compares to TTA network average
 * 4. Export bar         — CSV download + PDF report buttons
 * 5. Super admin only:  — league table of all schools
 * 6. Public page toggle — enable/disable the public /impact/:slug page
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, KpiCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import * as impactService from '@/services/impactService';

const ADMIN_NAV = [
  { to: '/app/admin',            label: 'Overview', end: true },
  { to: '/app/admin/enrollments',label: 'Enrolments' },
  { to: '/app/admin/staff',      label: 'Staff' },
  { to: '/app/admin/curriculum', label: 'Curriculum' },
  { to: '/app/admin/terms',      label: 'Terms' },
  { to: '/app/admin/tiers',      label: 'Tiers' },
  { to: '/app/admin/impact',     label: 'Impact' },
  { to: '/app/admin/billing',    label: 'Billing' },
];

// ── Root ──────────────────────────────────────────────────────────────────────

export function ImpactDashboardView() {
  const { schoolId, schoolName, role } = useAuth();
  const isSuperAdmin = role === 'super_admin';

  return (
    <AppShell title="Impact Dashboard" navItems={ADMIN_NAV}>
      <div className="max-w-[980px]">
        <div className="mb-s-7">
          <div className="font-mono text-eyebrow uppercase text-gold-400">
            {isSuperAdmin ? 'TTA Network' : schoolName}
          </div>
          <h2 className="mt-s-3 font-display text-display-2 text-ink-0">
            Impact &amp; outcomes.
          </h2>
          <p className="mt-s-3 text-body text-ink-2 max-w-[62ch]">
            {isSuperAdmin
              ? 'Network-wide metrics across all TTA schools. Use these to demonstrate educational outcomes to funders and NGOs.'
              : 'Your school\'s measurable outcomes. Export a grant-ready report in one click.'}
          </p>
        </div>

        {isSuperAdmin
          ? <SuperAdminImpact />
          : <SchoolAdminImpact schoolId={schoolId} schoolName={schoolName} />
        }
      </div>
    </AppShell>
  );
}

// ── School admin view ─────────────────────────────────────────────────────────

function SchoolAdminImpact({ schoolId, schoolName }) {
  const { data: impact,    isLoading: impactLoading    } = useQuery({
    queryKey: ['impact', schoolId],
    queryFn:  () => impactService.getSchoolImpact(schoolId),
    enabled:  !!schoolId,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: network } = useQuery({
    queryKey: ['impact', 'network'],
    queryFn:  impactService.getNetworkBenchmarks,
    staleTime: 5 * 60 * 1000,
  });

  const { data: snapshots } = useQuery({
    queryKey: ['impact', 'snapshots', schoolId],
    queryFn:  () => impactService.getImpactSnapshots(schoolId, 12),
    enabled:  !!schoolId,
    staleTime: 60_000,
  });

  if (impactLoading) return <LoadingSkeleton />;
  if (!impact) return <NoDataCard />;

  return (
    <div className="space-y-s-7">
      <KpiBand impact={impact} network={network} />
      {snapshots?.length > 1 && <TrendSection snapshots={snapshots} />}
      <NetworkComparisonSection impact={impact} network={network} />
      <ExportBar schoolId={schoolId} schoolName={schoolName} />
      <PublicPageToggle schoolId={schoolId} impact={impact} />
    </div>
  );
}

// ── Super admin view ──────────────────────────────────────────────────────────

function SuperAdminImpact() {
  const { data: allSchools, isLoading } = useQuery({
    queryKey: ['impact', 'all-schools'],
    queryFn:  impactService.getAllSchoolsImpact,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: network } = useQuery({
    queryKey: ['impact', 'network'],
    queryFn:  impactService.getNetworkBenchmarks,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <LoadingSkeleton />;

  const totals = {
    pupil_count:           allSchools?.reduce((a, s) => a + (s.pupil_count ?? 0), 0) ?? 0,
    linked_parent_count:   allSchools?.reduce((a, s) => a + (s.linked_parent_count ?? 0), 0) ?? 0,
    whatsapp_sent_7d:      allSchools?.reduce((a, s) => a + (s.whatsapp_sent_7d ?? 0), 0) ?? 0,
    pdf_downloads_7d:      allSchools?.reduce((a, s) => a + (s.pdf_downloads_7d ?? 0), 0) ?? 0,
  };

  return (
    <div className="space-y-s-7">
      {/* Network KPI band */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-s-4">
        <KpiCard label="Schools"          value={(allSchools?.length ?? 0).toLocaleString()} />
        <KpiCard label="Total pupils"     value={totals.pupil_count.toLocaleString()} />
        <KpiCard label="Linked parents"   value={totals.linked_parent_count.toLocaleString()} />
        <KpiCard label="Network attend"
          value={network ? `${network.network_attendance_pct}%` : '—'}
          trend="14-day average" trendIntent="neutral" />
        <KpiCard label="Parent eng avg"
          value={network ? `${network.network_parent_engagement_pct}%` : '—'}
          trend="7-day active" trendIntent="neutral" />
        <KpiCard label="WA delivery avg"
          value={network ? `${network.network_whatsapp_delivery_pct}%` : '—'}
          trend="7-day" trendIntent="neutral" />
        <KpiCard label="PDFs this week"   value={totals.pdf_downloads_7d.toLocaleString()} />
        <KpiCard label="WA sent · 7d"     value={totals.whatsapp_sent_7d.toLocaleString()} />
      </div>

      {/* School league table */}
      <Card className="bg-surface-2 border-line-2">
        <div className="flex items-center justify-between mb-s-5">
          <div className="font-mono text-eyebrow uppercase text-gold-400">All schools</div>
          <span className="font-mono text-meta text-ink-3">
            Sorted by pupil count
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-line-2">
                {['School', 'Pupils', 'Attend 14d', 'Trend', 'Avg score', 'Parent eng', 'WA del'].map((h) => (
                  <th key={h} className="font-mono text-eyebrow uppercase text-ink-3 pb-s-3 pr-s-5 whitespace-nowrap text-sm">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(allSchools ?? []).map((s) => (
                <tr key={s.school_id} className="border-b border-line-2 last:border-0 hover:bg-surface-3 transition-colors">
                  <td className="py-s-3 pr-s-5">
                    <div className="text-body text-ink-0">{s.school_name}</div>
                    {s.slug && (
                      <div className="font-mono text-meta text-ink-3">/impact/{s.slug}</div>
                    )}
                  </td>
                  <td className="py-s-3 pr-s-5 font-mono text-meta text-ink-1 tabular-nums">
                    {(s.pupil_count ?? 0).toLocaleString()}
                  </td>
                  <td className="py-s-3 pr-s-5">
                    <TrendBadge value={s.attendance_14d_pct} suffix="%" benchmark={network?.network_attendance_pct} />
                  </td>
                  <td className="py-s-3 pr-s-5">
                    <DeltaBadge delta={s.attendance_trend_pts} />
                  </td>
                  <td className="py-s-3 pr-s-5">
                    <TrendBadge value={s.avg_score_pct} suffix="%" benchmark={network?.network_avg_score_pct} />
                  </td>
                  <td className="py-s-3 pr-s-5">
                    <TrendBadge value={s.parent_engagement_7d_pct} suffix="%" benchmark={network?.network_parent_engagement_pct} />
                  </td>
                  <td className="py-s-3">
                    <TrendBadge value={s.whatsapp_delivery_pct} suffix="%" benchmark={network?.network_whatsapp_delivery_pct} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ── KPI band ──────────────────────────────────────────────────────────────────

function KpiBand({ impact, network }) {
  const trend = (value, benchmark, label) => {
    if (!benchmark || value == null) return { text: label, intent: 'neutral' };
    const diff = value - benchmark;
    if (diff >= 1)   return { text: `▲ ${diff.toFixed(1)} vs network`, intent: 'green' };
    if (diff <= -1)  return { text: `▼ ${Math.abs(diff).toFixed(1)} vs network`, intent: 'amber' };
    return { text: 'On par with network', intent: 'neutral' };
  };

  const atTrend = trend(impact.attendance_14d_pct, network?.network_attendance_pct, '14-day average');
  const scoreTrend = trend(impact.avg_score_pct, network?.network_avg_score_pct, 'All assessments');
  const engTrend = trend(impact.parent_engagement_7d_pct, network?.network_parent_engagement_pct, '7-day active');

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-s-4">
      <KpiCard
        label="Attendance · 14d"
        value={impact.attendance_14d_pct != null ? `${impact.attendance_14d_pct}%` : '—'}
        trend={atTrend.text}
        trendIntent={atTrend.intent}
      />
      <KpiCard
        label="Attendance trend"
        value={impact.attendance_trend_pts != null
          ? `${impact.attendance_trend_pts > 0 ? '+' : ''}${impact.attendance_trend_pts} pts`
          : '—'}
        trend="vs prior 14 days"
        trendIntent={impact.attendance_trend_pts > 0 ? 'green' : impact.attendance_trend_pts < 0 ? 'amber' : 'neutral'}
      />
      <KpiCard
        label="Avg grade score"
        value={impact.avg_score_pct != null ? `${impact.avg_score_pct}%` : '—'}
        trend={scoreTrend.text}
        trendIntent={scoreTrend.intent}
      />
      <KpiCard
        label="Parent engagement · 7d"
        value={impact.parent_engagement_7d_pct != null ? `${impact.parent_engagement_7d_pct}%` : '—'}
        trend={`${impact.active_parents_7d ?? 0} of ${impact.linked_parent_count ?? 0} parents`}
        trendIntent={engTrend.intent}
      />
      <KpiCard
        label="WhatsApp delivery · 7d"
        value={impact.whatsapp_delivery_pct != null ? `${impact.whatsapp_delivery_pct}%` : '—'}
        trend={`${impact.whatsapp_sent_7d ?? 0} sent`}
        trendIntent={(impact.whatsapp_delivery_pct ?? 0) >= 90 ? 'green' : 'amber'}
      />
      <KpiCard
        label="PDF downloads · 7d"
        value={(impact.pdf_downloads_7d ?? 0).toLocaleString()}
        trend="lesson PDFs by parents"
        trendIntent="neutral"
      />
    </div>
  );
}

// ── Trend section ─────────────────────────────────────────────────────────────

function TrendSection({ snapshots }) {
  const weeks = snapshots.map((s) => {
    const d = new Date(s.snapshot_date + 'T00:00:00');
    return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
  });

  return (
    <Card className="bg-surface-2 border-line-2">
      <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-5">
        12-week trends
      </div>
      <div className="space-y-s-6">
        <SparklineRow
          label="Attendance %"
          values={snapshots.map((s) => s.attendance_14d_pct ?? 0)}
          weeks={weeks}
          color="text-gold-400"
          max={100}
        />
        <SparklineRow
          label="Parent eng %"
          values={snapshots.map((s) => s.parent_engagement_7d_pct ?? 0)}
          weeks={weeks}
          color="text-blue-400"
          max={100}
        />
        <SparklineRow
          label="WA delivery %"
          values={snapshots.map((s) => s.whatsapp_delivery_pct ?? 0)}
          weeks={weeks}
          color="text-green-400"
          max={100}
        />
      </div>
    </Card>
  );
}

function SparklineRow({ label, values, weeks, color, max = 100 }) {
  const barMax = 6; // visual max height in CSS units

  return (
    <div>
      <div className="font-mono text-meta uppercase text-ink-3 mb-s-2">{label}</div>
      <div className="flex items-end gap-[3px]" style={{ height: '48px' }}>
        {values.map((v, i) => {
          const pct = Math.min(100, (v / max) * 100);
          const h   = Math.max(2, (pct / 100) * 48);
          return (
            <div
              key={i}
              title={`${weeks[i]}: ${v}%`}
              className={`flex-1 rounded-t-sm transition-all ${color.replace('text-', 'bg-')} opacity-80`}
              style={{ height: `${h}px` }}
            />
          );
        })}
      </div>
      <div className="flex justify-between mt-s-1">
        <span className="font-mono text-[9px] text-ink-3">{weeks[0]}</span>
        <span className="font-mono text-[9px] text-ink-3">{weeks[weeks.length - 1]}</span>
      </div>
    </div>
  );
}

// ── Network comparison ────────────────────────────────────────────────────────

function NetworkComparisonSection({ impact, network }) {
  if (!network) return null;

  const metrics = [
    { label: 'Attendance',       school: impact.attendance_14d_pct,      net: network.network_attendance_pct,      suffix: '%' },
    { label: 'Avg grade score',  school: impact.avg_score_pct,           net: network.network_avg_score_pct,       suffix: '%' },
    { label: 'Parent engagement',school: impact.parent_engagement_7d_pct,net: network.network_parent_engagement_pct,suffix: '%' },
    { label: 'WA delivery',      school: impact.whatsapp_delivery_pct,   net: network.network_whatsapp_delivery_pct,suffix: '%' },
  ];

  return (
    <Card className="bg-surface-2 border-line-2">
      <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-5">
        Your school vs TTA network
      </div>
      <div className="space-y-s-4">
        {metrics.map(({ label, school, net, suffix }) => {
          const diff     = (school ?? 0) - (net ?? 0);
          const isAbove  = diff >= 0.5;
          const isBelow  = diff <= -0.5;
          const schoolPct = Math.min(100, ((school ?? 0) / 100) * 100);
          const netPct    = Math.min(100, ((net ?? 0) / 100) * 100);

          return (
            <div key={label}>
              <div className="flex items-center justify-between mb-s-1">
                <span className="text-body text-ink-1">{label}</span>
                <div className="flex items-center gap-s-3">
                  <span className="font-mono text-meta text-ink-0 tabular-nums">
                    {school != null ? `${school}${suffix}` : '—'}
                  </span>
                  {isAbove && <Chip variant="green" size="sm">▲ {diff.toFixed(1)} above avg</Chip>}
                  {isBelow && <Chip variant="amber" size="sm">▼ {Math.abs(diff).toFixed(1)} below avg</Chip>}
                </div>
              </div>
              {/* Dual bar: school (gold) vs network (grey) */}
              <div className="relative h-2 bg-surface-3 rounded-full overflow-hidden">
                <div className="absolute left-0 top-0 h-full bg-surface-1 rounded-full opacity-40"
                     style={{ width: `${netPct}%` }} />
                <div className="absolute left-0 top-0 h-full bg-gold-400 rounded-full"
                     style={{ width: `${schoolPct}%` }} />
              </div>
              <div className="flex justify-between mt-s-1 font-mono text-[10px] text-ink-3">
                <span>0{suffix}</span>
                <span>Network avg: {net != null ? `${net}${suffix}` : '—'}</span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ── Export bar ────────────────────────────────────────────────────────────────

function ExportBar({ schoolId, schoolName }) {
  const [csvLoading, setCsvLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error,      setError]      = useState(null);

  async function handleCsv() {
    setCsvLoading(true); setError(null);
    try { await impactService.downloadImpactCsv({ schoolId, schoolName }); }
    catch (e) { setError(e.message); }
    finally   { setCsvLoading(false); }
  }

  async function handlePdf() {
    setPdfLoading(true); setError(null);
    try { await impactService.downloadImpactPdf({ schoolId, schoolName }); }
    catch (e) { setError(e.message); }
    finally   { setPdfLoading(false); }
  }

  return (
    <Card className="bg-surface-2 border-gold-400/20">
      <div className="flex flex-wrap items-center justify-between gap-s-5">
        <div>
          <div className="font-mono text-eyebrow uppercase text-gold-400">Grant reports</div>
          <p className="mt-s-2 text-body text-ink-2 max-w-[55ch]">
            Export anonymised outcome data for grant applications, NGO partnerships,
            and funding reports. No pupil or parent information is included.
          </p>
        </div>
        <div className="flex gap-s-3">
          <Button intent="ghost" onClick={handleCsv} disabled={csvLoading}>
            {csvLoading ? 'Preparing…' : 'Download CSV'}
          </Button>
          <Button intent="primary" onClick={handlePdf} disabled={pdfLoading}>
            {pdfLoading ? 'Generating…' : 'Download PDF report'}
          </Button>
        </div>
      </div>
      {error && (
        <p className="mt-s-3 text-body text-red-400 text-sm">{error}</p>
      )}
    </Card>
  );
}

// ── Public impact page toggle ──────────────────────────────────────────────────

function PublicPageToggle({ schoolId, impact }) {
  const queryClient = useQueryClient();
  const [tagline, setTagline] = useState(impact.impact_page_tagline ?? '');
  const [saved,   setSaved]   = useState(false);

  const { mutate, isPending, error } = useMutation({
    mutationFn: ({ enabled, tagline }) =>
      impactService.updateImpactPageSettings({ schoolId, enabled, tagline }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['impact', schoolId] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const isEnabled = impact.impact_page_enabled;
  const publicUrl = impact.slug ? `/impact/${impact.slug}` : null;

  return (
    <Card className="bg-surface-2 border-line-2">
      <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-4">
        Public impact page
      </div>
      <div className="flex flex-wrap items-start gap-s-5">
        <div className="flex-1 min-w-[280px]">
          <p className="text-body text-ink-2 mb-s-4">
            When enabled, your school's impact metrics appear at a public URL
            you can share with funders, parents, and the community.
            No personal information is shown.
          </p>
          {publicUrl && (
            <div className="bg-surface-3 border border-line-2 rounded-r-1 px-s-4 py-s-3 font-mono text-meta text-ink-1 mb-s-4">
              traintoteachafrica.org{publicUrl}
            </div>
          )}
          <div className="mb-s-4">
            <label className="font-mono text-eyebrow uppercase text-ink-3 block mb-s-2">
              Tagline (optional)
            </label>
            <input
              className="w-full bg-surface-3 border border-line-2 rounded-r-1 px-s-3 py-s-3 text-body text-ink-0 placeholder-ink-3 focus:border-gold-400 outline-none"
              value={tagline}
              onChange={(e) => { setTagline(e.target.value); setSaved(false); }}
              placeholder="Transforming education in Lagos State"
            />
          </div>
          {error && (
            <p className="text-body text-red-400 mb-s-3">{error.message}</p>
          )}
        </div>
        <div className="flex flex-col gap-s-3 items-start">
          <Chip variant={isEnabled ? 'green' : 'default'} dot>
            {isEnabled ? 'Public' : 'Private'}
          </Chip>
          {isEnabled ? (
            <Button
              intent="ghost"
              onClick={() => mutate({ enabled: false, tagline })}
              disabled={isPending}
            >
              {isPending ? 'Saving…' : 'Disable public page'}
            </Button>
          ) : (
            <Button
              intent="primary"
              onClick={() => mutate({ enabled: true, tagline })}
              disabled={isPending}
            >
              {isPending ? 'Saving…' : 'Enable public page'}
            </Button>
          )}
          {isEnabled && tagline !== impact.impact_page_tagline && (
            <Button
              intent="ghost"
              size="sm"
              onClick={() => mutate({ enabled: true, tagline })}
              disabled={isPending}
            >
              Save tagline
            </Button>
          )}
          {saved && <span className="font-mono text-meta text-green-400">Saved ✓</span>}
        </div>
      </div>
    </Card>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function TrendBadge({ value, suffix = '', benchmark }) {
  if (value == null) return <span className="font-mono text-meta text-ink-3">—</span>;
  const diff = benchmark != null ? value - benchmark : null;
  const color = diff == null ? 'text-ink-1'
              : diff >= 1   ? 'text-green-400'
              : diff <= -1  ? 'text-amber-400'
              :                'text-ink-1';
  return (
    <span className={`font-mono text-meta tabular-nums ${color}`}>
      {value}{suffix}
    </span>
  );
}

function DeltaBadge({ delta }) {
  if (delta == null) return <span className="font-mono text-meta text-ink-3">—</span>;
  const sign  = delta > 0 ? '+' : '';
  const color = delta > 0 ? 'text-green-400' : delta < 0 ? 'text-amber-400' : 'text-ink-3';
  return (
    <span className={`font-mono text-meta tabular-nums ${color}`}>
      {sign}{delta} pts
    </span>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-s-5">
      {[1,2,3].map((i) => (
        <div key={i} className="h-28 rounded-r-2 bg-surface-2 border border-line-2 animate-pulse" />
      ))}
    </div>
  );
}

function NoDataCard() {
  return (
    <Card className="bg-surface-2 border-line-2">
      <p className="text-body text-ink-2">
        No impact data available yet. Metrics appear once your school has
        attendance records and at least one week of data.
      </p>
    </Card>
  );
}
