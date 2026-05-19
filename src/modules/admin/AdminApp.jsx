/**
 * src/modules/admin/AdminApp.jsx — rebuilt with real data
 * Roles: school_admin (full nav) | head_teacher (no Billing)
 */

import { useState } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { Card, KpiCard } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { QuickActionCard, QuickActionGrid } from '@/components/ui/QuickActionCard';
import { useAuth } from '@/hooks/useAuth';
import * as simsService from '@/services/simsService';
import * as billingService from '@/services/billingService';
import { supabase } from '@/lib/supabase';
import { PupilImportView }    from './PupilImportView';
import { PupilSingleAddView } from './PupilSingleAddView';
import { PupilPinManager }    from './PupilPinManager';
import { StaffView }          from './StaffView';
import { CurriculumView }     from './CurriculumView';
import { TermLocksView }      from './TermLocksView';
import { ImpactDashboardView } from './ImpactDashboardView';
import { ConnectionsView }     from './ConnectionsView';
import { SchoolSettingsView }  from './SchoolSettingsView';
import { SchoolInterventionsView } from './SchoolInterventionsView';
import { BillingDashboardView } from '@/modules/billing/BillingDashboardView';
import { InvoiceEditorView }    from '@/modules/billing/InvoiceEditorView';
import { BulkInvoiceView }      from '@/modules/billing/BulkInvoiceView';
import { InvoicePrintView }     from '@/modules/billing/InvoicePrintView';

const BASE_NAV = [
  { to: '/app/admin',                label: 'Overview',       end: true },
  { to: '/app/admin/interventions',  label: 'Interventions'             },
  { to: '/app/admin/enrollments',    label: 'Enrolments'                },
  { to: '/app/admin/staff',          label: 'Staff'                     },
  { to: '/app/admin/connections',    label: 'Connections'               },
  { to: '/app/admin/curriculum',     label: 'Curriculum'                },
  { to: '/app/admin/terms',          label: 'Terms'                     },
  { to: '/app/admin/alerts',         label: 'Alerts'                    },
  { to: '/app/admin/impact',         label: 'Impact'                    },
  { to: '/app/admin/settings',       label: 'Settings'                  },
];

function buildNav(role) {
  if (role === 'school_admin') return [...BASE_NAV, { to: '/app/admin/billing', label: 'Billing' }];
  return BASE_NAV;
}

export default function AdminApp() {
  const { role } = useAuth();
  const nav = buildNav(role);
  const wrap = (title, el) => <AppShell title={title} navItems={nav}>{el}</AppShell>;

  return (
    <Routes>
      <Route index                element={<OverviewView />} />
      <Route path="interventions" element={wrap('Interventions', <SchoolInterventionsView />)} />
      <Route path="enrollments"   element={wrap('Enrolments', <EnrollmentsView />)} />
      <Route path="pupils/import" element={wrap('Import pupils', <PupilImportView />)} />
      <Route path="pupils/add"    element={wrap('Add pupil', <PupilSingleAddView />)} />
      <Route path="pupils/pins"   element={wrap('Student PINs', <PupilPinManager />)} />
      <Route path="staff"         element={wrap('Staff', <StaffView />)} />
      <Route path="connections"   element={wrap('Connections', <ConnectionsView />)} />
      <Route path="curriculum"    element={wrap('Curriculum', <CurriculumView />)} />
      <Route path="terms"         element={wrap('Terms', <TermLocksView />)} />
      <Route path="alerts"        element={<AlertsView />} />
      <Route path="impact"        element={wrap('Impact', <ImpactDashboardView />)} />
      <Route path="settings"      element={wrap('Settings', <SchoolSettingsView />)} />
      {role === 'school_admin' && (
        <>
          <Route path="billing"                           element={<BillingDashboardView />} />
          <Route path="billing/invoice/:invoiceId"        element={<InvoiceEditorView />} />
          <Route path="billing/invoice/:invoiceId/print"  element={<InvoicePrintView />} />
          <Route path="billing/invoice/new"               element={<InvoiceEditorView />} />
          <Route path="billing/bulk"                      element={<BulkInvoiceView />} />
        </>
      )}
    </Routes>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────────
function OverviewView() {
  const { schoolId, schoolName, role } = useAuth();
  const nav = buildNav(role);

  // Current term heuristic — matches billing dashboard
  const month = new Date().getMonth() + 1;
  const currentTerm = month >= 9 ? 'term_1' : month <= 4 ? 'term_2' : 'term_3';
  const currentYear = new Date().getFullYear();

  const { data: kpis,   isLoading: kpisLoading }   = useQuery({ queryKey: ['admin','kpis',schoolId],   queryFn: () => simsService.getSchoolKpis(schoolId),  enabled: !!schoolId, staleTime: 300_000, refetchInterval: 300_000 });
  const { data: alerts, isLoading: alertsLoading }  = useQuery({ queryKey: ['admin','alerts',schoolId], queryFn: () => fetchAlerts(schoolId),                enabled: !!schoolId, staleTime: 60_000,  refetchInterval: 60_000  });
  const { data: atRisk }                            = useQuery({ queryKey: ['admin','atrisk',schoolId], queryFn: () => fetchAtRisk(schoolId),                enabled: !!schoolId, staleTime: 300_000 });
  const { data: trend }                             = useQuery({ queryKey: ['admin','trend',schoolId],  queryFn: () => simsService.getAttendanceTrend({ schoolId, days: 14 }), enabled: !!schoolId, staleTime: 300_000 });
  const { data: billing }                           = useQuery({ queryKey: ['billing','summary',schoolId,currentTerm,currentYear], queryFn: () => billingService.getBillingSummary({ schoolId, term: currentTerm, year: currentYear }), enabled: !!schoolId && role === 'school_admin', staleTime: 300_000 });

  // Derived values
  const attendancePct  = kpis?.attendance_14d_pct ?? null;
  const alertCount     = alerts?.length ?? 0;
  const collectionPct  = billing?.collection_rate_pct ?? null;

  const attendanceDelta    = attendancePct != null
    ? (attendancePct >= 90 ? `${attendancePct}%` : attendancePct >= 75 ? `${attendancePct}%` : `${attendancePct}%`)
    : null;
  const attendanceDeltaDir = attendancePct == null ? 'flat'
    : attendancePct >= 90 ? 'up' : attendancePct >= 75 ? 'flat' : 'down';

  // Action urgency — use per-school threshold from settings
  const riskThreshold   = parseInt(localStorage.getItem(`tta:risk:${schoolId}`) ?? '80', 10);
  const attendanceUrgent = attendancePct != null && attendancePct < riskThreshold;
  const alertsUrgent     = alertCount > 0;

  return (
    <AppShell title="Overview" navItems={nav}>
      <div className="max-w-[980px]">

        {/* Greeting */}
        <div className="mb-s-7">
          <div className="font-mono text-eyebrow uppercase text-gold-400">
            {schoolName ?? 'Your school'}
          </div>
          <h2 className="mt-s-2 font-display text-display-2 text-ink-0">
            School overview.
          </h2>
        </div>

        {/* ── KPI row ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-s-4 mb-s-7">
          <KpiCard
            label="Pupils enrolled"
            value={kpisLoading ? '…' : (kpis?.pupil_count ?? 0).toLocaleString()}
            delta={kpis?.class_count != null ? undefined : undefined}
            footnote={kpis?.class_count != null ? `across ${kpis.class_count} class${kpis.class_count !== 1 ? 'es' : ''}` : undefined}
            isLoading={kpisLoading}
          />
          <KpiCard
            label="Attendance · 14d"
            value={attendancePct != null ? `${attendancePct}%` : '—'}
            delta={attendanceDelta}
            deltaDir={attendanceDeltaDir}
            footnote={attendancePct != null
              ? (attendancePct >= 90 ? 'Above 90% target' : attendancePct >= 75 ? 'Below 90% target' : 'Needs urgent action')
              : undefined}
            isLoading={kpisLoading}
          />
          <KpiCard
            label="Open alerts"
            value={alertsLoading ? '…' : String(alertCount)}
            delta={alertCount > 0 ? `${alertCount} need${alertCount === 1 ? 's' : ''} attention` : 'All clear'}
            deltaDir={alertCount > 0 ? 'down' : 'up'}
            isLoading={alertsLoading}
          />
          {role === 'school_admin'
            ? (
              <KpiCard
                label="Fees collected"
                value={collectionPct != null ? `${collectionPct}%` : '—'}
                delta={collectionPct != null
                  ? (collectionPct >= 80 ? `${billingService.fmtKobo(billing?.collected_kobo)} collected` : `${billingService.fmtKobo(billing?.outstanding_kobo)} outstanding`)
                  : undefined}
                deltaDir={collectionPct == null ? 'flat' : collectionPct >= 80 ? 'up' : 'down'}
                footnote={billingService.fmtTerm(currentTerm) + ' ' + currentYear}
              />
            )
            : (
              <KpiCard
                label="Classes"
                value={kpisLoading ? '…' : String(kpis?.class_count ?? 0)}
                footnote="active this term"
                isLoading={kpisLoading}
              />
            )
          }
        </div>

        {/* ── Quick-action grid ────────────────────────────────────────────── */}
        <QuickActionGrid className="mb-s-7">
          <QuickActionCard
            variant={attendanceUrgent ? 'primary' : 'default'}
            urgent={attendanceUrgent}
            label="Attendance"
            meta={attendancePct != null
              ? `${attendancePct}% · 14-day average`
              : 'Check registers'}
            icon={<QaCheckIcon />}
            to="/app/admin/alerts"
          />
          <QuickActionCard
            label="Enrolments"
            meta="Add pupils or import CSV"
            icon={<QaUsersIcon />}
            to="/app/admin/enrollments"
          />
          <QuickActionCard
            urgent={alertsUrgent}
            label="Alerts"
            meta={alertCount > 0 ? `${alertCount} open alert${alertCount !== 1 ? 's' : ''}` : 'All clear'}
            icon={<QaAlertIcon />}
            to="/app/admin/alerts"
          />
          {role === 'school_admin'
            ? (
              <QuickActionCard
                label="Billing"
                meta={collectionPct != null ? `${collectionPct}% collected this term` : 'Manage invoices'}
                icon={<QaCurrencyIcon />}
                to="/app/admin/billing"
              />
            )
            : (
              <QuickActionCard
                label="Terms"
                meta="Lock and unlock terms"
                icon={<QaLockIcon />}
                to="/app/admin/terms"
              />
            )
          }
        </QuickActionGrid>

        {/* ── Attendance sparkline + info ──────────────────────────────────── */}
        {trend && trend.length > 0 && (
          <Card className="bg-surface-2 border-line-2 mb-s-6">
            <div className="flex items-center justify-between mb-s-4">
              <div>
                <div className="font-mono text-eyebrow uppercase text-gold-400">Attendance</div>
                <div className="font-display text-display-3 text-ink-0 mt-s-1">14-day trend</div>
              </div>
              <div className="text-right">
                <div className="font-display text-[28px] text-ink-0 leading-none">
                  {attendancePct != null ? `${attendancePct}%` : '—'}
                </div>
                <div className="font-mono text-meta text-ink-3 mt-s-1">avg this period</div>
              </div>
            </div>
            <AttendanceSparkline data={trend} threshold={parseInt(localStorage.getItem(`tta:risk:${schoolId}`) ?? '80', 10)} />
            <div className="mt-s-4 flex justify-between font-mono text-[11px] text-ink-3">
              <span>{trend[0]?.trend_date ? fmtDay(trend[0].trend_date) : ''}</span>
              <span>{trend[trend.length - 1]?.trend_date ? fmtDay(trend[trend.length - 1].trend_date) : ''}</span>
            </div>
          </Card>
        )}

        {/* ── Alerts + at-risk ────────────────────────────────────────────── */}
        <div className="grid lg:grid-cols-2 gap-s-5">
          <Card className="bg-surface-2 border-line-2">
            <div className="flex items-center justify-between mb-s-4">
              <div className="font-display text-display-3 text-ink-0">Alerts</div>
              {alertCount > 0 && <Chip variant="amber" dot>{alertCount} open</Chip>}
            </div>
            {alertCount === 0
              ? <div className="flex items-center gap-s-3"><Chip variant="green" dot>All clear</Chip><span className="text-body text-ink-2">No alerts right now.</span></div>
              : (
                <ul className="space-y-s-3">
                  {(alerts ?? []).slice(0, 4).map((a, i) => (
                    <li key={i} className="flex items-start gap-s-3">
                      <span className={`mt-[6px] w-[6px] h-[6px] rounded-full shrink-0 ${
                        a.severity === 'red'  ? 'bg-red-400'   :
                        a.severity === 'info' ? 'bg-gold-400'  :
                                                'bg-amber-400'
                      }`} />
                      <span className="text-[13.5px] text-ink-1">
                        {a.alert_type === 'pending_connection'
                          ? <Link to="/app/admin/connections" className="hover:text-gold-400">{a.message}</Link>
                          : a.message
                        }
                      </span>
                    </li>
                  ))}
                  {alertCount > 4 && (
                    <li>
                      <Link to="/app/admin/alerts" className="font-mono text-meta text-gold-400 hover:underline">
                        +{alertCount - 4} more →
                      </Link>
                    </li>
                  )}
                </ul>
              )
            }
          </Card>

          <Card className="bg-surface-2 border-line-2">
            <div className="flex items-center justify-between mb-s-4">
              <div className="font-display text-display-3 text-ink-0">At-risk pupils</div>
              <span className="font-mono text-meta text-ink-3">14-day window</span>
            </div>
            {(atRisk?.length ?? 0) === 0
              ? <div className="flex items-center gap-s-3"><Chip variant="green" dot>None</Chip><span className="text-body text-ink-2">No attendance concerns.</span></div>
              : (
                <div className="space-y-s-2">
                  {(atRisk ?? []).slice(0, 5).map((p) => (
                    <div key={p.pupil_id} className="flex items-center justify-between py-s-2 border-b border-line-2 last:border-0">
                      <div>
                        <div className="text-[13.5px] text-ink-1">{p.pupil_name}</div>
                        <div className="font-mono text-[11px] text-ink-3">{p.class_name}</div>
                      </div>
                      <Chip variant={Number(p.absent_count) >= 5 ? 'red' : 'amber'} size="sm">
                        {p.absent_count} absent
                      </Chip>
                    </div>
                  ))}
                  {atRisk.length > 5 && (
                    <Link to="/app/admin/alerts" className="font-mono text-meta text-gold-400 hover:underline block mt-s-2">
                      +{atRisk.length - 5} more →
                    </Link>
                  )}
                </div>
              )
            }
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

// ── Attendance sparkline ──────────────────────────────────────────────────────

function AttendanceSparkline({ data, threshold = 80 }) {
  if (!data?.length) return null;

  const W = 600, H = 72, PAD_X = 0, PAD_Y = 4;
  const MIN_Y = 60, MAX_Y = 100;

  const stepX = (W - PAD_X * 2) / Math.max(data.length - 1, 1);

  const toY = (pct) =>
    H - PAD_Y - ((pct - MIN_Y) / (MAX_Y - MIN_Y)) * (H - PAD_Y * 2);

  const linePath = data
    .map((d, i) => {
      const x = PAD_X + i * stepX;
      const y = toY(Number(d.present_pct ?? 0));
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');

  const areaPath = [
    linePath,
    `L ${(PAD_X + (data.length - 1) * stepX).toFixed(1)} ${H}`,
    `L ${PAD_X} ${H} Z`,
  ].join(' ');

  const thresholdY = toY(threshold);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-[72px]"
      role="img"
      aria-label="14-day attendance trend chart"
    >
      <defs>
        <linearGradient id="sparkGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%"   stopColor="#e5a62a" stopOpacity="0.30" />
          <stop offset="100%" stopColor="#e5a62a" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Threshold target line */}
      <line
        x1={PAD_X} y1={thresholdY}
        x2={W - PAD_X} y2={thresholdY}
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="1"
        strokeDasharray="4 4"
      />
      <text
        x={W - PAD_X - 2}
        y={thresholdY - 4}
        textAnchor="end"
        fontFamily="var(--f-mono)"
        fontSize="9"
        fill="rgba(255,255,255,0.3)"
      >
        {threshold}%
      </text>

      {/* Area fill */}
      <path d={areaPath} fill="url(#sparkGrad)" />

      {/* Line */}
      <path d={linePath} stroke="#e5a62a" strokeWidth="1.5" fill="none" strokeLinejoin="round" />

      {/* Data point dots — only for below-threshold days */}
      {data.map((d, i) => {
        const pct = Number(d.present_pct ?? 0);
        if (pct >= 90) return null;
        const x = PAD_X + i * stepX;
        const y = toY(pct);
        return (
          <circle
            key={i}
            cx={x.toFixed(1)} cy={y.toFixed(1)} r="3"
            fill={pct < 75 ? '#ef5350' : '#f5a524'}
            stroke="var(--c-surface-2, #13162a)"
            strokeWidth="1.5"
          />
        );
      })}
    </svg>
  );
}

function fmtDay(dateStr) {
  try {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-NG', {
      day: 'numeric', month: 'short',
    });
  } catch { return dateStr; }
}

// Inline SVG icons for QuickActionCards — 18×18, 1.5px stroke
function QaCheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3 10.5L10 3l7 5.5V17a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M7.5 18v-5.5h5V18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function QaUsersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="8" cy="7" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 17c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M13.5 5a2.5 2.5 0 0 1 0 5M18 17c0-2.8-2-5.1-4.5-5.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function QaAlertIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 3L2 17h16L10 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M10 9v3M10 14.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function QaCurrencyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 5.5v9M7.5 7.5c0-1.1 1.1-2 2.5-2s2.5.9 2.5 2-1.1 2-2.5 2-2.5.9-2.5 2 1.1 2 2.5 2 2.5-.9 2.5-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function QaLockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="4" y="9" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 9V7a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="10" cy="14" r="1.5" fill="currentColor" />
    </svg>
  );
}

// ── Alerts full view ──────────────────────────────────────────────────────────
function AlertsView() {
  const { schoolId, role } = useAuth();
  const nav = buildNav(role);
  const { data: alerts, isLoading } = useQuery({ queryKey: ['admin','alerts',schoolId], queryFn: () => fetchAlerts(schoolId), enabled: !!schoolId, staleTime: 60_000, refetchInterval: 60_000 });
  const { data: atRisk } = useQuery({ queryKey: ['admin','atrisk',schoolId], queryFn: () => fetchAtRisk(schoolId), enabled: !!schoolId, staleTime: 300_000 });

  const byType = (alerts ?? []).reduce((acc, a) => { (acc[a.alert_type]??=[]).push(a); return acc; }, {});

  return (
    <AppShell title="Alerts" navItems={nav}>
      <div className="max-w-[820px]">
        <div className="mb-s-7">
          <div className="font-mono text-eyebrow uppercase text-gold-400">Alerts</div>
          <h2 className="mt-s-3 font-display text-display-2 text-ink-0">What needs your attention.</h2>
          <p className="mt-s-3 text-body text-ink-2 max-w-[60ch]">Automatically generated from attendance, assessment, and report data. Updated every minute.</p>
        </div>

        {isLoading && <Skeleton />}

        {!isLoading && (alerts??[]).length === 0 && (
          <Card className="bg-surface-2 border-green-400/20 bg-green-400/[0.03]">
            <div className="flex items-center gap-s-3"><Chip variant="green" dot>All clear</Chip><span className="text-body text-ink-1">No alerts right now.</span></div>
          </Card>
        )}

        <div className="space-y-s-7">
          {[
            { key: 'pending_connection',   label: 'Pending parent connection requests', severity: 'info', link: '/app/admin/connections' },
            { key: 'no_attendance_today',  label: 'Classes with no attendance today' },
            { key: 'absence_streak',       label: 'Absence streaks' },
            { key: 'ungraded_assessment',  label: 'Assessments without scores' },
            { key: 'report_stalled',       label: 'Reports stalled in approval', severity: 'red' },
          ].filter(({ key }) => byType[key]?.length > 0).map(({ key, label, severity='amber', link }) => (
            <section key={key}>
              <div className="flex items-center gap-s-3 mb-s-4">
                <h3 className="font-display text-display-3 text-ink-0">{label}</h3>
                <Chip variant={severity === 'info' ? 'gold' : severity} dot>{byType[key].length}</Chip>
                {link && (
                  <Link to={link} className="ml-auto font-mono text-meta text-gold-400 hover:underline">
                    Review →
                  </Link>
                )}
              </div>
              <div className="bg-surface-2 border border-line-2 rounded-r-3 overflow-hidden">
                {byType[key].map((a,i) => (
                  <div key={i} className="flex items-start gap-s-3 px-s-4 py-s-3 border-b border-line-2 last:border-0">
                    <span className={`mt-[6px] w-[6px] h-[6px] rounded-full shrink-0 ${
                      severity === 'red'  ? 'bg-red-400'  :
                      severity === 'info' ? 'bg-gold-400' :
                                           'bg-amber-400'
                    }`} />
                    <span className="text-body text-ink-1">{a.message}</span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        {(atRisk??[]).length > 0 && (
          <div className="mt-s-8">
            <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-4">At-risk pupils — 14 day window</div>
            <Card className="bg-surface-2 border-line-2 overflow-hidden">
              <table className="w-full text-left">
                <thead><tr className="border-b border-line-2">{['Pupil','Class','Absences','Late','Last seen'].map(h=><th key={h} className="font-mono text-eyebrow uppercase text-ink-3 pb-s-3 pr-s-4 text-xs">{h}</th>)}</tr></thead>
                <tbody>
                  {atRisk.map(p=>(
                    <tr key={p.pupil_id} className="border-b border-line-2 last:border-0 hover:bg-surface-3 transition-colors">
                      <td className="py-s-3 pr-s-4 text-body text-ink-0">{p.pupil_name}</td>
                      <td className="py-s-3 pr-s-4 text-body text-ink-2">{p.class_name}</td>
                      <td className="py-s-3 pr-s-4"><Chip variant={Number(p.absent_count)>=5?'red':'amber'} size="sm">{p.absent_count}</Chip></td>
                      <td className="py-s-3 pr-s-4 font-mono text-meta text-ink-3">{p.late_count}</td>
                      <td className="py-s-3 font-mono text-meta text-ink-3">{p.last_seen_date ? new Date(p.last_seen_date).toLocaleDateString('en-NG',{day:'numeric',month:'short'}) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  );
}

// ── Enrolments ────────────────────────────────────────────────────────────────
function EnrollmentsView() {
  return (
    <div className="max-w-[820px]">
      <div className="mb-s-7">
        <div className="font-mono text-eyebrow uppercase text-gold-400">Enrolments</div>
        <h2 className="mt-s-3 font-display text-display-2 text-ink-0">Add pupils to the school.</h2>
        <p className="mt-s-3 text-body text-ink-2 max-w-[58ch]">Bulk-import from a CSV or add one at a time for mid-term arrivals.</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-s-4">
        {[
          { to:'/app/admin/pupils/import', eyebrow:'Bulk import',   title:'Paste a CSV',    desc:'Add many pupils at once. Validates each row before saving.' },
          { to:'/app/admin/pupils/add',    eyebrow:'Single pupil',  title:'Add one pupil',  desc:'One-at-a-time form for mid-term arrivals or small rosters.' },
          { to:'/app/admin/pupils/pins',   eyebrow:'Student PINs',  title:'Set login PINs', desc:'Generate or reset the 4-digit PINs pupils use to log into TTA Learn.' },
        ].map(({to,eyebrow,title,desc}) => (
          <Link key={to} to={to} className="block bg-surface-2 border border-line-1 rounded-r-3 p-s-6 hover:border-gold-400/40 hover:bg-surface-3 transition-all">
            <div className="font-mono text-eyebrow uppercase text-gold-400">{eyebrow}</div>
            <h3 className="mt-s-2 font-display text-display-3 text-ink-0">{title}</h3>
            <p className="mt-s-3 text-[13.5px] text-ink-2">{desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── Data fetchers ─────────────────────────────────────────────────────────────
async function fetchAlerts(schoolId) {
  const { data, error } = await supabase.from('school_alerts_v').select('*').eq('school_id', schoolId).order('severity');
  if (error) { console.warn('[alerts]', error.message); return []; }
  return data ?? [];
}
async function fetchAtRisk(schoolId) {
  // Use the per-school threshold set in SchoolSettingsView (default 80%)
  const threshold = parseInt(localStorage.getItem(`tta:risk:${schoolId}`) ?? '80', 10);
  // Convert attendance % threshold to minimum absences over 14 days:
  // if threshold is 80% and there are 14 days, a pupil needs > (1 - 0.80) * 14 = 2.8 absences
  // so we use 3 as the minimum for an 80% threshold, scaling down for stricter thresholds
  const minAbsences = Math.max(1, Math.round((1 - threshold / 100) * 14));
  const { data, error } = await supabase.rpc('get_at_risk_pupils', {
    p_school_id:   schoolId,
    p_days:        14,
    p_min_absences: minAbsences,
  });
  if (error) { console.warn('[at-risk]', error.message); return []; }
  return data ?? [];
}

function Skeleton() {
  return <div className="space-y-s-4">{[1,2,3].map(i=><div key={i} className="h-24 rounded-r-2 bg-surface-2 border border-line-2 animate-pulse"/>)}</div>;
}

function fmtPlan(code) {
  if (!code) return '—';
  return code.replace('AFR_','African · ').replace('INT_','International · ').replace('_ANNUAL',' · Annual').replace('_TERM',' · Term').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
}
