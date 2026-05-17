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
import { useAuth } from '@/hooks/useAuth';
import * as simsService from '@/services/simsService';
import { supabase } from '@/lib/supabase';
import { PupilImportView }    from './PupilImportView';
import { PupilSingleAddView } from './PupilSingleAddView';
import { StaffView }          from './StaffView';
import { TiersView }          from './TiersView';
import { CurriculumView }     from './CurriculumView';
import { TermLocksView }      from './TermLocksView';
import { ImpactDashboardView } from './ImpactDashboardView';
import { ConnectionsView }    from './ConnectionsView';

const BASE_NAV = [
  { to: '/app/admin',             label: 'Overview',   end: true },
  { to: '/app/admin/enrollments', label: 'Enrolments' },
  { to: '/app/admin/staff',       label: 'Staff'      },
  { to: '/app/admin/connections', label: 'Connections' },
  { to: '/app/admin/curriculum',  label: 'Curriculum' },
  { to: '/app/admin/terms',       label: 'Terms'      },
  { to: '/app/admin/alerts',      label: 'Alerts'      },
  { to: '/app/admin/impact',      label: 'Impact'      },
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
      <Route path="enrollments"   element={wrap('Enrolments', <EnrollmentsView />)} />
      <Route path="pupils/import" element={wrap('Import pupils', <PupilImportView />)} />
      <Route path="pupils/add"    element={wrap('Add pupil', <PupilSingleAddView />)} />
      <Route path="staff"         element={wrap('Staff', <StaffView />)} />
      <Route path="connections"   element={wrap('Connections', <ConnectionsView />)} />
      <Route path="curriculum"    element={wrap('Curriculum', <CurriculumView />)} />
      <Route path="terms"         element={wrap('Terms', <TermLocksView />)} />
      <Route path="alerts"        element={<AlertsView />} />
      <Route path="impact"        element={<ImpactDashboardView />} />
      {role === 'school_admin' && <Route path="billing" element={<BillingView />} />}
    </Routes>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────────
function OverviewView() {
  const { schoolId, schoolName, role } = useAuth();
  const nav = buildNav(role);

  const { data: kpis }   = useQuery({ queryKey: ['admin','kpis',schoolId],   queryFn: () => simsService.getSchoolKpis(schoolId), enabled: !!schoolId, staleTime: 300_000, refetchInterval: 300_000 });
  const { data: alerts } = useQuery({ queryKey: ['admin','alerts',schoolId], queryFn: () => fetchAlerts(schoolId),               enabled: !!schoolId, staleTime: 60_000,  refetchInterval: 60_000  });
  const { data: atRisk } = useQuery({ queryKey: ['admin','atrisk',schoolId], queryFn: () => fetchAtRisk(schoolId),               enabled: !!schoolId, staleTime: 300_000 });

  return (
    <AppShell title="Overview" navItems={nav}>
      <div className="max-w-[980px]">
        <div className="mb-s-7">
          <div className="font-mono text-eyebrow uppercase text-gold-400">{schoolName ?? 'Your school'}</div>
          <h2 className="mt-s-3 font-display text-display-2 text-ink-0">School overview.</h2>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-s-4 mb-s-8">
          <KpiCard label="Pupils"         value={(kpis?.pupil_count ?? 0).toLocaleString()}                                                                                       trend="enrolled"                                                                        trendIntent="neutral" />
          <KpiCard label="Classes"        value={kpis?.class_count ?? 0}                                                                                                               trend="active"                                                                          trendIntent="neutral" />
          <KpiCard label="Attendance 14d" value={kpis?.attendance_14d_pct != null ? `${kpis.attendance_14d_pct}%` : '—'}                                                              trend={kpis?.attendance_14d_pct >= 90 ? '↑ Good' : kpis?.attendance_14d_pct >= 75 ? '↓ Below target' : '↓ Needs action'} trendIntent={kpis?.attendance_14d_pct >= 90 ? 'green' : kpis?.attendance_14d_pct >= 75 ? 'amber' : 'red'} />
          <KpiCard label="Open alerts"    value={(alerts?.length ?? 0).toString()}                                                                                                     trend={alerts?.length > 0 ? 'needs attention' : 'all clear'}                             trendIntent={alerts?.length > 0 ? 'amber' : 'green'} />
        </div>

        <div className="grid lg:grid-cols-2 gap-s-6">
          {/* Alerts preview */}
          <Card className="bg-surface-2 border-line-2">
            <div className="flex items-center justify-between mb-s-4">
              <div className="font-display text-display-3 text-ink-0">Alerts</div>
              {(alerts?.length ?? 0) > 0 && <Chip variant="amber" size="sm">{alerts.length} open</Chip>}
            </div>
            {(alerts?.length ?? 0) === 0
              ? <div className="flex items-center gap-s-3"><Chip variant="green" dot>All clear</Chip><span className="text-body text-ink-2">No alerts right now.</span></div>
              : <ul className="space-y-s-3">
                  {(alerts ?? []).slice(0,4).map((a,i) => (
                    <li key={i} className="flex items-start gap-s-3">
                      <span className={`mt-[6px] w-[6px] h-[6px] rounded-full shrink-0 ${a.severity==='red'?'bg-red-400':'bg-amber-400'}`} />
                      <span className="text-[13.5px] text-ink-1">{a.message}</span>
                    </li>
                  ))}
                  {alerts.length > 4 && <li><Link to="/app/admin/alerts" className="font-mono text-meta text-gold-400 hover:underline">+{alerts.length-4} more →</Link></li>}
                </ul>
            }
          </Card>

          {/* At-risk */}
          <Card className="bg-surface-2 border-line-2">
            <div className="flex items-center justify-between mb-s-4">
              <div className="font-display text-display-3 text-ink-0">At-risk pupils</div>
              <span className="font-mono text-meta text-ink-3">14-day window</span>
            </div>
            {(atRisk?.length ?? 0) === 0
              ? <div className="flex items-center gap-s-3"><Chip variant="green" dot>None</Chip><span className="text-body text-ink-2">No attendance concerns.</span></div>
              : <div className="space-y-s-2">
                  {(atRisk ?? []).slice(0,5).map((p) => (
                    <div key={p.pupil_id} className="flex items-center justify-between py-s-2 border-b border-line-2 last:border-0">
                      <div>
                        <div className="text-[13.5px] text-ink-1">{p.pupil_name}</div>
                        <div className="font-mono text-[11px] text-ink-3">{p.class_name}</div>
                      </div>
                      <Chip variant={Number(p.absent_count)>=5?'red':'amber'} size="sm">{p.absent_count} absent</Chip>
                    </div>
                  ))}
                  {atRisk.length > 5 && <Link to="/app/admin/alerts" className="font-mono text-meta text-gold-400 hover:underline block mt-s-2">+{atRisk.length-5} more →</Link>}
                </div>
            }
          </Card>
        </div>
      </div>
    </AppShell>
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
            { key: 'no_attendance_today',  label: 'Classes with no attendance today' },
            { key: 'absence_streak',       label: 'Absence streaks' },
            { key: 'ungraded_assessment',  label: 'Assessments without scores' },
            { key: 'report_stalled',       label: 'Reports stalled in approval', severity: 'red' },
          ].filter(({ key }) => byType[key]?.length > 0).map(({ key, label, severity='amber' }) => (
            <section key={key}>
              <div className="flex items-center gap-s-3 mb-s-4">
                <h3 className="font-display text-display-3 text-ink-0">{label}</h3>
                <Chip variant={severity} dot>{byType[key].length}</Chip>
              </div>
              <div className="bg-surface-2 border border-line-2 rounded-r-3 overflow-hidden">
                {byType[key].map((a,i) => (
                  <div key={i} className="flex items-start gap-s-3 px-s-4 py-s-3 border-b border-line-2 last:border-0">
                    <span className={`mt-[6px] w-[6px] h-[6px] rounded-full shrink-0 ${severity==='red'?'bg-red-400':'bg-amber-400'}`} />
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

// ── Billing view ──────────────────────────────────────────────────────────────
function BillingView() {
  const { schoolId, role } = useAuth();
  const nav = buildNav(role);
  const { data: billing, isLoading } = useQuery({ queryKey: ['admin','billing',schoolId], queryFn: () => fetchBilling(schoolId), enabled: !!schoolId, staleTime: 300_000 });

  const sub = billing?.active_subscription;
  const payments = billing?.recent_payments ?? [];

  return (
    <AppShell title="Billing" navItems={nav}>
      <div className="max-w-[820px]">
        <div className="mb-s-7">
          <div className="font-mono text-eyebrow uppercase text-gold-400">Billing</div>
          <h2 className="mt-s-3 font-display text-display-2 text-ink-0">Subscription and payments.</h2>
        </div>
        {isLoading && <Skeleton />}
        {!isLoading && (
          <div className="space-y-s-6">
            <Card className={`border-2 ${sub?.status==='active'?'border-green-400/25 bg-green-400/[0.02]':'border-amber-400/25 bg-amber-400/[0.02]'}`}>
              <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-4">School subscription</div>
              {sub
                ? <div className="grid sm:grid-cols-3 gap-s-5">
                    <div><div className="font-mono text-meta text-ink-3 mb-s-1">Plan</div><div className="text-body text-ink-0">{fmtPlan(sub.plan_code)}</div></div>
                    <div><div className="font-mono text-meta text-ink-3 mb-s-1">Status</div><Chip variant={sub.status==='active'?'green':'amber'} dot>{sub.status}</Chip></div>
                    <div>
                      <div className="font-mono text-meta text-ink-3 mb-s-1">Expires</div>
                      <div className="text-body text-ink-0">{new Date(sub.ends_at).toLocaleDateString('en-NG',{day:'numeric',month:'long',year:'numeric'})}</div>
                      <div className="font-mono text-meta text-ink-3 mt-s-1">{sub.days_left} days remaining</div>
                    </div>
                  </div>
                : <p className="text-body text-ink-2">No active school subscription. Contact TTA to subscribe.</p>
              }
            </Card>

            <Card className="bg-surface-2 border-line-2">
              <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-3">Parent subscriptions</div>
              <div className="flex items-center gap-s-4">
                <div className="font-display text-display-2 text-ink-0">{billing?.parent_sub_count ?? 0}</div>
                <div className="text-body text-ink-2">active parent subscriptions linked to your school's pupils</div>
              </div>
            </Card>

            <Card className="bg-surface-2 border-line-2">
              <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-5">Recent payments</div>
              {payments.length === 0
                ? <p className="text-body text-ink-2">No payment records found.</p>
                : <div className="space-y-s-1">
                    {payments.map(py => {
                      const prefix = py.currency==='NGN'?'₦':'$';
                      const amt = Math.round(py.amount_minor/100).toLocaleString('en-NG');
                      const date = new Date(py.created_at).toLocaleDateString('en-NG',{day:'numeric',month:'short',year:'numeric'});
                      const color = py.status==='verified'?'green':py.status==='failed'?'red':'amber';
                      return (
                        <div key={py.reference} className="flex items-center gap-s-4 py-s-3 border-b border-line-2 last:border-0">
                          <div className="flex-1 min-w-0">
                            <div className="text-[13.5px] text-ink-1 truncate">{fmtPlan(py.plan_code)}</div>
                            <div className="font-mono text-meta text-ink-3">{date} · {py.reference?.slice(-8)}</div>
                          </div>
                          <div className="font-mono text-[14px] text-ink-0 tabular-nums shrink-0">{prefix}{amt}</div>
                          <Chip variant={color} dot>{py.status}</Chip>
                        </div>
                      );
                    })}
                  </div>
              }
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
  const { data, error } = await supabase.rpc('get_at_risk_pupils', { p_school_id: schoolId, p_days: 14, p_min_absences: 3 });
  if (error) { console.warn('[at-risk]', error.message); return []; }
  return data ?? [];
}
async function fetchBilling(schoolId) {
  const { data, error } = await supabase.rpc('get_school_billing_summary', { p_school_id: schoolId });
  if (error) throw new Error(`Could not load billing: ${error.message}`);
  return data;
}

function Skeleton() {
  return <div className="space-y-s-4">{[1,2,3].map(i=><div key={i} className="h-24 rounded-r-2 bg-surface-2 border border-line-2 animate-pulse"/>)}</div>;
}

function fmtPlan(code) {
  if (!code) return '—';
  return code.replace('AFR_','African · ').replace('INT_','International · ').replace('_ANNUAL',' · Annual').replace('_TERM',' · Term').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
}
```</Routes>
