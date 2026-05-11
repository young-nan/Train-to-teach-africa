/**
 * src/modules/admin/AdminApp.jsx
 *
 * The school admin dashboard. The proprietor's view.
 *
 * Information density is allowed here — admins are paid to look at metrics.
 * But the hierarchy must still be tight: one hero KPI band, then secondary
 * panels.
 */

import { Routes, Route } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { Card, KpiCard } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { useAuth } from '@/hooks/useAuth';
import * as simsService from '@/services/simsService';
import { PupilImportView } from './PupilImportView';
import { PupilSingleAddView } from './PupilSingleAddView';
import { StaffView } from './StaffView';
import { TiersView } from './TiersView';

const NAV = [
  { to: '/app/admin', label: 'Overview', end: true },
  { to: '/app/admin/enrollments', label: 'Enrolments' },
  { to: '/app/admin/staff', label: 'Staff' },
  { to: '/app/admin/tiers', label: 'Tiers' },
  { to: '/app/admin/billing', label: 'Billing' },
  { to: '/app/admin/curriculum', label: 'Curriculum' },
  { to: '/app/admin/alerts', label: 'Alerts' },
];

export default function AdminApp() {
  return (
    <Routes>
      <Route index element={<OverviewView />} />
      <Route path="enrollments" element={<EnrollmentsView />} />
      <Route path="pupils/import" element={<EnrollmentsShell><PupilImportView /></EnrollmentsShell>} />
      <Route path="pupils/add" element={<EnrollmentsShell><PupilSingleAddView /></EnrollmentsShell>} />
      <Route path="staff" element={<StaffShell><StaffView /></StaffShell>} />
      <Route path="tiers" element={<TiersShell><TiersView /></TiersShell>} />
      <Route path="billing" element={<Placeholder title="Billing" />} />
      <Route path="curriculum" element={<Placeholder title="Curriculum" />} />
      <Route path="alerts" element={<Placeholder title="Alerts" />} />
    </Routes>
  );
}

function OverviewView() {
  const { schoolId, schoolName } = useAuth();

  const { data: kpis } = useQuery({
    queryKey: ['admin', 'kpis', schoolId],
    queryFn: () => simsService.getSchoolKpis(schoolId),
    enabled: !!schoolId,
    staleTime: 60_000,
  });

  return (
    <AppShell title="Overview" navItems={NAV}>
      <div>
        {/* Greeting band */}
        <div className="mb-s-7">
          <div className="font-mono text-eyebrow uppercase text-gold-400">{schoolName ?? 'Your school'}</div>
          <h2 className="mt-s-3 font-display text-display-2 text-ink-0">School overview.</h2>
        </div>

        {/* Hero KPI band */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-s-4 mb-s-9">
          <KpiCard label="Pupils" value={(kpis?.pupil_count ?? 0).toLocaleString()} trend="▲ 8.4% YoY" trendIntent="green" />
          <KpiCard label="Classes" value={kpis?.class_count ?? 0} trend="—" trendIntent="neutral" />
          <KpiCard label="Attendance · 14d" value={kpis?.attendance_14d_pct ? `${kpis.attendance_14d_pct}%` : '—'} trend="▲ 1.2 pts" trendIntent="green" />
          <KpiCard label="At-risk pupils" value="—" trend="See list →" trendIntent="amber" />
        </div>

        {/* Two-column secondary panels */}
        <div className="grid lg:grid-cols-2 gap-s-5">
          <Card>
            <div className="flex items-center justify-between mb-s-4">
              <div className="font-display text-display-3 text-ink-0">Recent payments</div>
              <Chip variant="default">View all →</Chip>
            </div>
            <div className="space-y-s-3">
              <PaymentRow label="School Bundle · Annual" amount="₦176,256" status="verified" />
              <PaymentRow label="Parent · Annual" amount="₦31,184" status="verified" />
              <PaymentRow label="Parent · Term" amount="₦10,847" status="pending" />
            </div>
          </Card>
          <Card>
            <div className="font-display text-display-3 text-ink-0 mb-s-4">Alerts</div>
            <ul className="space-y-s-3">
              <AlertRow intent="amber" body="3 pupils with absence > 4 days" />
              <AlertRow intent="amber" body="Term 2 reports awaiting head teacher review" />
              <AlertRow intent="green" body="All staff CPD modules up to date" />
            </ul>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function PaymentRow({ label, amount, status }) {
  const variant = status === 'verified' ? 'green' : status === 'failed' ? 'red' : 'amber';
  return (
    <div className="flex items-center justify-between gap-s-4 py-s-2 border-b border-line-1 last:border-0">
      <span className="text-[13.5px] text-ink-1 truncate">{label}</span>
      <div className="flex items-center gap-s-3">
        <span className="font-mono text-[13px] text-ink-1">{amount}</span>
        <Chip variant={variant} dot>{status}</Chip>
      </div>
    </div>
  );
}

function AlertRow({ intent, body }) {
  return (
    <li className="flex items-start gap-s-3">
      <span className={`mt-[8px] w-[6px] h-[6px] rounded-full bg-${intent}-400 shrink-0`} aria-hidden="true" />
      <span className="text-[13.5px] text-ink-1">{body}</span>
    </li>
  );
}

function Placeholder({ title }) {
  return (
    <AppShell title={title} navItems={NAV}>
      <Card><div className="font-display text-display-3 text-ink-0">{title}</div></Card>
    </AppShell>
  );
}

function EnrollmentsShell({ children }) {
  return (
    <AppShell title="Enrolments" navItems={NAV}>
      {children}
    </AppShell>
  );
}

function StaffShell({ children }) {
  return (
    <AppShell title="Staff" navItems={NAV}>
      {children}
    </AppShell>
  );
}

function TiersShell({ children }) {
  return (
    <AppShell title="Tiers" navItems={NAV}>
      {children}
    </AppShell>
  );
}

/**
 * Enrolments overview. In v1 this is a simple jump-off to the bulk
 * importer; per-pupil edit / class assignment comes in v1.1.
 */
function EnrollmentsView() {
  return (
    <EnrollmentsShell>
      <div className="max-w-[820px]">
        <div className="mb-s-7">
          <div className="font-mono text-eyebrow uppercase text-gold-400">Enrolments</div>
          <h2 className="mt-s-3 font-display text-display-2 text-ink-0">
            Add pupils to the school.
          </h2>
          <p className="mt-s-3 text-body text-ink-2 max-w-[58ch]">
            Bulk-import pupils from a CSV. The fastest path for a new
            school is to paste your existing class lists; the system
            will validate every row before saving anything.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-s-4">
          <a href="/app/admin/pupils/import" className="block bg-surface-2 border border-line-1 rounded-r-3 p-s-6 hover:border-gold-400/40 hover:bg-surface-3 transition-all duration-150">
            <div className="font-mono text-eyebrow uppercase text-gold-400">Bulk import</div>
            <h3 className="mt-s-2 font-display text-display-3 text-ink-0">Paste a CSV</h3>
            <p className="mt-s-3 text-[13.5px] text-ink-2">
              Add many pupils at once. Validates each row before insert.
            </p>
            <div className="mt-s-5 text-gold-200 text-[13px]">Open importer →</div>
          </a>
          <a href="/app/admin/pupils/add" className="block bg-surface-2 border border-line-1 rounded-r-3 p-s-6 hover:border-gold-400/40 hover:bg-surface-3 transition-all duration-150">
            <div className="font-mono text-eyebrow uppercase text-gold-400">Single pupil</div>
            <h3 className="mt-s-2 font-display text-display-3 text-ink-0">Add one pupil</h3>
            <p className="mt-s-3 text-[13.5px] text-ink-2">
              One-at-a-time form for mid-term arrivals or small rosters.
            </p>
            <div className="mt-s-5 text-gold-200 text-[13px]">Open form →</div>
          </a>
        </div>
      </div>
    </EnrollmentsShell>
  );
}
