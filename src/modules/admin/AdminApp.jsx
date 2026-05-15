/**
 * src/modules/admin/AdminApp.jsx
 *
 * School admin and head teacher dashboard.
 *
 * WHAT CHANGED FROM THE PLACEHOLDER VERSION
 * ──────────────────────────────────────────
 * 1. All KPIs come from real DB queries (school_kpis_v + at_risk_pupils RPC)
 * 2. Recent payments come from real DB (recent_school_payments view)
 * 3. Alerts come from real DB (school_alerts table + generate_school_alerts RPC)
 * 4. head_teacher role sees a narrower nav — no Billing or Tiers
 * 5. Attendance trend sparkline driven by attendance_trend RPC
 *
 * ROLE SPLIT
 * ──────────
 * school_admin → full nav (Overview, Enrolments, Staff, Curriculum, Terms,
 *                          Tiers, Billing, Alerts, Impact)
 * head_teacher → reduced nav (Overview, Enrolments, Staff, Curriculum, Terms,
 *                             Alerts) — no billing, no pricing
 */

import { useState } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { Card, KpiCard } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import * as simsService from '@/services/simsService';
import * as impactService from '@/services/impactService';
import { supabase } from '@/lib/supabase';
import { PupilImportView } from './PupilImportView';
import { PupilSingleAddView } from './PupilSingleAddView';
import { StaffView } from './StaffView';
import { TiersView } from './TiersView';
import { CurriculumView } from './CurriculumView';
import { TermLocksView } from './TermLocksView';
import { ImpactDashboardView } from './ImpactDashboardView';

// ── Nav definition ────────────────────────────────────────────────────────────

function buildNav(role) {
  const base = [
    { to: '/app/admin',              label: 'Overview',   end: true },
    { to: '/app/admin/enrollments',  label: 'Enrolments' },
    { to: '/app/admin/staff',        label: 'Staff'       },
    { to: '/app/admin/curriculum',   label: 'Curriculum'  },
    { to: '/app/admin/terms',        label: 'Terms'       },
    { to: '/app/admin/alerts',       label: 'Alerts'      },
    { to: '/app/admin/impact',       label: 'Impact'      },
  ];
  if (role === 'school_admin') {
    base.push(
      { to: '/app/admin/tiers',   label: 'Pricing' },
      { to: '/app/admin/billing', label: 'Billing' },
    );
  }
  return base;
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function AdminApp() {
  const { role } = useAuth();
  const NAV = buildNav(role);

  return (
    <Routes>
      <Route index element={<OverviewView nav={NAV} />} />
      <Route path="enrollments" element={<EnrollmentsView nav={NAV} />} />
      <Route path="pupils/import" element={<Shell nav={NAV} title="Bulk Import"><PupilImportView /></Shell>} />
      <Route path="pupils/add" element={<Shell nav={NAV} title="Add Pupil"><PupilSingleAddView /></Shell>} />
      <Route path="staff" element={<Shell nav={NAV} title="Staff"><StaffView /></Shell>} />
      <Route path="curriculum" element={<Shell nav={NAV} title="Curriculum"><CurriculumView /></Shell>} />
      <Route path="terms" element={<Shell nav={NAV} title="Terms"><TermLocksView /></Shell>} />
      <Route path="alerts" element={<AlertsView nav={NAV} />} />
      <Route path="impact" element={<Shell nav={NAV} title="Impact"><ImpactDashboardView /></Shell>} />
      {role === 'school_admin' && (
        <>
          <Route path="tiers" element={<Shell nav={NAV} title="Pricing"><TiersView /></Shell>} />
          <Route path="billing" element={<BillingView nav={NAV} />} />
        </>
      )}
    </Routes>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────────

function OverviewView({ nav }) {
  const { schoolId, schoolName, role } = useAuth();
  const qc = useQueryClient();

  // Real KPIs from school_kpis_v (materialized, 5-min refresh)
  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['admin', 'kpis', schoolId],
    queryFn:  () => simsService.getSchoolKpis(schoolId),
    enabled:  !!schoolId,
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });

  // At-risk pupils (attendance < 80% last 14 days)
  const { data: atRisk } = useQuery({
    queryKey: ['admin', 'at-risk', schoolId],
    queryFn:  () => supabase.rpc('at_risk_pupils', { p_school_id: schoolId }).then((r) => r.data ?? []),
    enabled:  !!schoolId,
    staleTime: 10 * 60_000,
  });

  // Attendance trend (last 14 days) for sparkline
  const { data: trend } = useQuery({
    queryKey: ['admin', 'trend', schoolId],
    queryFn:  () => simsService.getAttendanceTrend({ schoolId, days: 14 }),
    enabled:  !!schoolId,
    staleTime: 10 * 60_000,
  });

  // Active (undismissed) alerts for the overview badge
  const { data: alerts } = useQuery({
    queryKey: ['admin', 'alerts', schoolId],
    queryFn:  () => supabase
      .from('school_alerts')
      .select('id, severity')
      .eq('school_id', schoolId)
      .is('dismissed_at', null)
      .order('severity')
      .then((r) => r.data ?? []),
    enabled: !!schoolId,
    staleTime: 5 * 60_000,
  });

  // Recent payments (school_admin only)
  const { data: payments } = useQuery({
    queryKey: ['admin', 'payments', schoolId],
    queryFn:  () => supabase
      .from('recent_school_payments')
      .select('id, plan_label, amount_minor, currency, status, verified_at')
      .eq('status', 'verified')
      .order('verified_at', { ascending: false })
      .limit(5)
      .then((r) => r.data ?? []),
    enabled: !!schoolId && role === 'school_admin',
    staleTime: 5 * 60_000,
  });

  const urgentAlerts = (alerts ?? []).filter((a) => a.severity === 'urgent');
  const warningAlerts = (alerts ?? []).filter((a) => a.severity === 'warning');

  return (
    <AppShell title="Overview" navItems={nav}>
      <div className="max-w-[980px]">
        {/* Greeting */}
        <div className="mb-s-8">
          <div className="font-mono text-eyebrow uppercase text-gold-400">{schoolName ?? 'Your school'}</div>
          <h2 className="mt-s-3 font-display text-display-2 text-ink-0">School overview.</h2>
          <p className="mt-s-3 text-body text-ink-2 max-w-[56ch]">
            Live data. KPIs refresh every 5 minutes. Alerts refresh daily at noon.
          </p>
        </div>

        {/* Hero KPI band — real data */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-s-4 mb-s-8">
          <KpiCard
            label="Pupils"
            value={kpisLoading ? '…' : (kpis?.pupil_count ?? 0).toLocaleString()}
            trend={`${kpis?.class_count ?? 0} classes`}
            trendIntent="neutral"
          />
          <KpiCard
            label="Attendance · 14d"
            value={kpis?.attendance_14d_pct != null ? `${kpis.attendance_14d_pct}%` : '—'}
            trend={
              trend?.length > 1
                ? `${trend[trend.length - 1]?.present_pct ?? '—'}% today`
                : '14-day average'
            }
            trendIntent={
              (kpis?.attendance_14d_pct ?? 100) >= 85 ? 'green'
              : (kpis?.attendance_14d_pct ?? 100) >= 70 ? 'amber'
              : 'red'
            }
          />
          <KpiCard
            label="At-risk pupils"
            value={(atRisk?.length ?? 0).toLocaleString()}
            trend="Attendance < 80%"
            trendIntent={(atRisk?.length ?? 0) === 0 ? 'green' : 'amber'}
          />
          <KpiCard
            label="Active alerts"
            value={(alerts?.length ?? 0).toLocaleString()}
            trend={urgentAlerts.length > 0 ? `${urgentAlerts.length} urgent` : 'all clear'}
            trendIntent={urgentAlerts.length > 0 ? 'red' : warningAlerts.length > 0 ? 'amber' : 'green'}
          />
        </div>

        <div className="grid lg:grid-cols-2 gap-s-6 mb-s-8">
          {/* Attendance sparkline */}
          <Card className="bg-surface-2 border-line-2">
            <div className="flex items-center justify-between mb-s-4">
              <div className="font-mono text-eyebrow uppercase text-gold-400">Attendance · 14 days</div>
              {kpis?.attendance_14d_pct != null && (
                <span className="font-display text-display-3 text-ink-0">{kpis.attendance_14d_pct}%</span>
              )}
            </div>
            {trend?.length > 0
              ? <AttendanceSparkline data={trend} />
              : <p className="text-body text-ink-3">No attendance data yet.</p>
            }
          </Card>

          {/* Alerts preview */}
          <Card className="bg-surface-2 border-line-2">
            <div className="flex items-center justify-between mb-s-4">
              <div className="font-mono text-eyebrow uppercase text-gold-400">Active alerts</div>
              {(alerts?.length ?? 0) > 0 && (
                <Link to="/app/admin/alerts">
                  <Chip variant="amber" size="sm">View all →</Chip>
                </Link>
              )}
            </div>
            {(alerts?.length ?? 0) === 0 ? (
              <div className="flex items-center gap-s-3">
                <span className="text-green-400">✓</span>
                <span className="text-body text-ink-2">No active alerts. School is running smoothly.</span>
              </div>
            ) : (
              <div className="space-y-s-3">
                {(alerts ?? []).slice(0, 5).map((a) => (
                  <AlertBadge key={a.id} severity={a.severity} />
                ))}
                {(alerts?.length ?? 0) > 5 && (
                  <Link to="/app/admin/alerts" className="font-mono text-meta text-gold-400 hover:underline">
                    +{alerts.length - 5} more →
                  </Link>
                )}
              </div>
            )}
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-s-6">
          {/* At-risk pupils */}
          <Card className="bg-surface-2 border-line-2">
            <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-4">
              At-risk pupils · 14 days
            </div>
            {(atRisk?.length ?? 0) === 0 ? (
              <p className="text-body text-ink-2">No at-risk pupils. All attendance above 80%.</p>
            ) : (
              <div className="space-y-s-3">
                {(atRisk ?? []).slice(0, 6).map((p) => (
                  <div key={p.pupil_id} className="flex items-center justify-between gap-s-3 py-s-1 border-b border-line-2 last:border-0">
                    <div>
                      <div className="text-body text-ink-1">{p.pupil_name}</div>
                      <div className="font-mono text-meta text-ink-3">{p.class_name}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-display text-[18px] text-amber-400">{p.attendance_pct}%</div>
                      <div className="font-mono text-meta text-ink-3">{p.absent_days} absent</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Recent payments (school_admin only) */}
          {role === 'school_admin' ? (
            <Card className="bg-surface-2 border-line-2">
              <div className="flex items-center justify-between mb-s-4">
                <div className="font-mono text-eyebrow uppercase text-gold-400">Recent payments</div>
                <Link to="/app/admin/billing">
                  <Chip variant="default" size="sm">View all →</Chip>
                </Link>
              </div>
              {(payments?.length ?? 0) === 0 ? (
                <p className="text-body text-ink-2">No verified payments yet.</p>
              ) : (
                <div className="space-y-s-2">
                  {(payments ?? []).map((p) => (
                    <PaymentRow key={p.id} payment={p} />
                  ))}
                </div>
              )}
            </Card>
          ) : (
            /* Head teachers see classes overview instead */
            <Card className="bg-surface-2 border-line-2">
              <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-4">Quick links</div>
              <div className="space-y-s-3">
                {[
                  { to: '/app/teacher/attendance', label: 'Mark attendance', icon: '✓' },
                  { to: '/app/teacher/gradebook',  label: 'Open gradebook',  icon: '📊' },
                  { to: '/app/teacher/reports',    label: 'View reports',     icon: '📄' },
                ].map((link) => (
                  <Link key={link.to} to={link.to}
                    className="flex items-center gap-s-3 py-s-2 px-s-3 rounded-r-1 hover:bg-surface-3 transition-colors">
                    <span>{link.icon}</span>
                    <span className="text-body text-ink-1">{link.label}</span>
                    <span className="ml-auto text-ink-3">→</span>
                  </Link>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}

// ── Alerts view ───────────────────────────────────────────────────────────────

function AlertsView({ nav }) {
  const { schoolId } = useAuth();
  const qc = useQueryClient();

  const { data: alerts, isLoading } = useQuery({
    queryKey: ['admin', 'alerts-full', schoolId],
    queryFn:  () => supabase
      .from('school_alerts')
      .select('*')
      .eq('school_id', schoolId)
      .is('dismissed_at', null)
      .order('severity')
      .order('created_at', { ascending: false })
      .then((r) => r.data ?? []),
    enabled:  !!schoolId,
    staleTime: 60_000,
  });

  const refresh = useMutation({
    mutationFn: () => supabase.rpc('generate_school_alerts', { p_school_id: schoolId }),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['admin', 'alerts'] }),
  });

  const dismiss = useMutation({
    mutationFn: (alertId) => supabase
      .from('school_alerts')
      .update({ dismissed_at: new Date().toISOString() })
      .eq('id', alertId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'alerts'] });
      qc.invalidateQueries({ queryKey: ['admin', 'alerts-full'] });
    },
  });

  const SEVERITY_ORDER = { urgent: 0, warning: 1, info: 2 };
  const sorted = (alerts ?? []).sort((a, b) =>
    (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3)
  );

  return (
    <AppShell title="Alerts" navItems={nav}>
      <div className="max-w-[820px]">
        <div className="mb-s-7 flex items-end justify-between gap-s-4 flex-wrap">
          <div>
            <div className="font-mono text-eyebrow uppercase text-gold-400">Alerts</div>
            <h2 className="mt-s-3 font-display text-display-2 text-ink-0">
              Things that need attention.
            </h2>
            <p className="mt-s-3 text-body text-ink-2 max-w-[56ch]">
              Automatically generated from attendance, gradebook, and term data.
              Refreshed daily at noon.
            </p>
          </div>
          <Button intent="ghost" onClick={() => refresh.mutate()} disabled={refresh.isPending}>
            {refresh.isPending ? 'Refreshing…' : '↻ Refresh now'}
          </Button>
        </div>

        {isLoading && <div className="space-y-s-3">{[1,2,3].map((i) => <div key={i} className="h-20 bg-surface-2 rounded-r-2 animate-pulse" />)}</div>}

        {!isLoading && sorted.length === 0 && (
          <Card className="bg-surface-2 border-line-2">
            <div className="flex items-center gap-s-3">
              <span className="text-green-400 text-xl">✓</span>
              <p className="text-body text-ink-1">No active alerts. School is running smoothly.</p>
            </div>
          </Card>
        )}

        <div className="space-y-s-3">
          {sorted.map((alert) => (
            <Card key={alert.id} className={`bg-surface-2 ${
              alert.severity === 'urgent' ? 'border-red-400/40' :
              alert.severity === 'warning' ? 'border-amber-400/40' :
              'border-line-2'
            }`}>
              <div className="flex items-start justify-between gap-s-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-s-2 mb-s-1">
                    <Chip
                      variant={alert.severity === 'urgent' ? 'red' : alert.severity === 'warning' ? 'amber' : 'default'}
                      dot size="sm"
                    >
                      {alert.severity}
                    </Chip>
                    <span className="font-mono text-meta text-ink-3 capitalize">
                      {alert.alert_type.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="text-body text-ink-0">{alert.title}</div>
                  {alert.body && <p className="mt-s-1 text-[13px] text-ink-2">{alert.body}</p>}
                  <div className="mt-s-2 font-mono text-meta text-ink-3">
                    {new Date(alert.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div className="flex gap-s-2 flex-shrink-0">
                  {alert.deep_link && (
                    <Link to={alert.deep_link}>
                      <Button intent="ghost" size="sm">View →</Button>
                    </Link>
                  )}
                  <Button intent="ghost" size="sm" onClick={() => dismiss.mutate(alert.id)}>
                    Dismiss
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

// ── Billing view ──────────────────────────────────────────────────────────────

function BillingView({ nav }) {
  const { schoolId } = useAuth();
  const [statusFilter, setStatusFilter] = useState('verified');

  const { data: payments, isLoading } = useQuery({
    queryKey: ['admin', 'billing', schoolId, statusFilter],
    queryFn:  () => supabase
      .from('recent_school_payments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
      .then((r) => {
        let rows = r.data ?? [];
        if (statusFilter !== 'all') rows = rows.filter((p) => p.status === statusFilter);
        return rows;
      }),
    enabled:  !!schoolId,
    staleTime: 60_000,
  });

  const totalVerified = (payments ?? [])
    .filter((p) => p.status === 'verified')
    .reduce((sum, p) => sum + Number(p.amount_minor), 0);

  return (
    <AppShell title="Billing" navItems={nav}>
      <div className="max-w-[900px]">
        <div className="mb-s-7">
          <div className="font-mono text-eyebrow uppercase text-gold-400">Billing</div>
          <h2 className="mt-s-3 font-display text-display-2 text-ink-0">Payment history.</h2>
          <p className="mt-s-3 text-body text-ink-2">Verified subscription payments for your school.</p>
        </div>

        {/* Summary card */}
        <Card className="bg-surface-2 border-gold-400/20 mb-s-6">
          <div className="flex flex-wrap gap-s-8">
            <div>
              <div className="font-mono text-eyebrow uppercase text-ink-3">Total collected</div>
              <div className="mt-s-1 font-display text-display-2 text-ink-0">
                ₦{Math.round(totalVerified / 100).toLocaleString('en-NG')}
              </div>
              <div className="font-mono text-meta text-ink-3">verified payments shown</div>
            </div>
            <div>
              <div className="font-mono text-eyebrow uppercase text-ink-3">Transactions</div>
              <div className="mt-s-1 font-display text-display-2 text-ink-0">
                {(payments ?? []).filter((p) => p.status === 'verified').length}
              </div>
              <div className="font-mono text-meta text-ink-3">last 50 records</div>
            </div>
          </div>
        </Card>

        {/* Filter */}
        <div className="flex gap-s-2 mb-s-4">
          {['all', 'verified', 'pending'].map((s) => (
            <button key={s}
              className={`px-s-4 py-s-2 rounded-full font-mono text-meta capitalize transition-colors border ${
                statusFilter === s
                  ? 'bg-gold-400 border-gold-400 text-ink-0'
                  : 'bg-surface-2 border-line-2 text-ink-2 hover:border-line-3'
              }`}
              onClick={() => setStatusFilter(s)}
            >
              {s}
            </button>
          ))}
        </div>

        {isLoading && <div className="h-64 bg-surface-2 rounded-r-3 animate-pulse" />}

        {!isLoading && (
          <Card className="bg-surface-2 border-line-2 overflow-hidden">
            {(payments?.length ?? 0) === 0 ? (
              <p className="text-body text-ink-2">No payments found.</p>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-line-2">
                    {['Payer', 'Plan', 'Amount', 'Status', 'Date'].map((h) => (
                      <th key={h} className="font-mono text-eyebrow uppercase text-ink-3 pb-s-3 pr-s-5 text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-line-2 last:border-0 hover:bg-surface-3 transition-colors">
                      <td className="py-s-3 pr-s-5">
                        <div className="text-body text-ink-1">{p.payer_name || '—'}</div>
                        <div className="font-mono text-meta text-ink-3">{p.payer_email}</div>
                      </td>
                      <td className="py-s-3 pr-s-5 text-body text-ink-1">{p.plan_label}</td>
                      <td className="py-s-3 pr-s-5 font-mono text-meta text-ink-0 tabular-nums">
                        {p.currency === 'NGN' ? '₦' : '$'}
                        {Math.round(p.amount_minor / 100).toLocaleString('en-NG')}
                      </td>
                      <td className="py-s-3 pr-s-5">
                        <Chip variant={p.status === 'verified' ? 'green' : p.status === 'failed' ? 'red' : 'amber'} dot size="sm">
                          {p.status}
                        </Chip>
                      </td>
                      <td className="py-s-3 font-mono text-meta text-ink-3">
                        {new Date(p.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        )}
      </div>
    </AppShell>
  );
}

// ── Enrolments view ───────────────────────────────────────────────────────────

function EnrollmentsView({ nav }) {
  return (
    <AppShell title="Enrolments" navItems={nav}>
      <div className="max-w-[820px]">
        <div className="mb-s-7">
          <div className="font-mono text-eyebrow uppercase text-gold-400">Enrolments</div>
          <h2 className="mt-s-3 font-display text-display-2 text-ink-0">Add pupils to the school.</h2>
          <p className="mt-s-3 text-body text-ink-2 max-w-[58ch]">
            Bulk-import from CSV for a new class list, or add individual pupils mid-term.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-s-4">
          <ActionCard
            to="/app/admin/pupils/import"
            eyebrow="Bulk import"
            title="Paste a CSV"
            body="Add many pupils at once. Validates each row before saving."
          />
          <ActionCard
            to="/app/admin/pupils/add"
            eyebrow="Single pupil"
            title="Add one pupil"
            body="One-at-a-time form for mid-term arrivals or small rosters."
          />
        </div>
      </div>
    </AppShell>
  );
}

// ── Small shared components ───────────────────────────────────────────────────

function Shell({ nav, title, children }) {
  return (
    <AppShell title={title} navItems={nav}>
      {children}
    </AppShell>
  );
}

function AttendanceSparkline({ data }) {
  const max = 100;
  return (
    <div>
      <div className="flex items-end gap-[3px]" style={{ height: '56px' }}>
        {data.map((d, i) => {
          const h = Math.max(3, ((d.present_pct ?? 0) / max) * 56);
          const color = d.present_pct >= 85 ? 'bg-green-400' : d.present_pct >= 70 ? 'bg-amber-400' : 'bg-red-400';
          return (
            <div key={i} className="flex-1 flex flex-col items-center">
              <div
                className={`w-full rounded-t-sm ${color} opacity-80`}
                style={{ height: `${h}px` }}
                title={`${d.trend_date}: ${d.present_pct}%`}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-s-1 font-mono text-[9px] text-ink-3">
        <span>{data[0]?.trend_date}</span>
        <span>{data[data.length - 1]?.trend_date}</span>
      </div>
    </div>
  );
}

function PaymentRow({ payment }) {
  const major = Math.round(payment.amount_minor / 100);
  const prefix = payment.currency === 'NGN' ? '₦' : '$';
  return (
    <div className="flex items-center justify-between gap-s-3 py-s-2 border-b border-line-2 last:border-0">
      <span className="text-[13.5px] text-ink-1 truncate">{payment.plan_label}</span>
      <div className="flex items-center gap-s-3 flex-shrink-0">
        <span className="font-mono text-[13px] text-ink-0 tabular-nums">
          {prefix}{major.toLocaleString('en-NG')}
        </span>
        <Chip variant="green" dot size="sm">verified</Chip>
      </div>
    </div>
  );
}

function AlertBadge({ severity }) {
  const config = {
    urgent:  { color: 'text-red-400',   icon: '●', label: 'Urgent alert' },
    warning: { color: 'text-amber-400', icon: '●', label: 'Warning' },
    info:    { color: 'text-blue-400',  icon: '●', label: 'Info' },
  };
  const c = config[severity] ?? config.info;
  return (
    <div className="flex items-center gap-s-2">
      <span className={c.color}>{c.icon}</span>
      <span className="text-body text-ink-2">{c.label}</span>
    </div>
  );
}

function ActionCard({ to, eyebrow, title, body }) {
  return (
    <Link to={to}
      className="block bg-surface-2 border border-line-2 rounded-r-3 p-s-6 hover:border-gold-400/40 hover:bg-surface-3 transition-all group">
      <div className="font-mono text-eyebrow uppercase text-gold-400">{eyebrow}</div>
      <h3 className="mt-s-2 font-display text-display-3 text-ink-0 group-hover:text-gold-400 transition-colors">{title}</h3>
      <p className="mt-s-3 text-[13.5px] text-ink-2">{body}</p>
      <div className="mt-s-5 text-gold-400 text-[13px]">Open →</div>
    </Link>
  );
}
