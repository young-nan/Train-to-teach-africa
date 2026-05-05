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

const NAV = [
  { to: '/app/admin', label: 'Overview', end: true },
  { to: '/app/admin/enrollments', label: 'Enrolments' },
  { to: '/app/admin/staff', label: 'Staff' },
  { to: '/app/admin/billing', label: 'Billing' },
  { to: '/app/admin/curriculum', label: 'Curriculum' },
  { to: '/app/admin/alerts', label: 'Alerts' },
];

export default function AdminApp() {
  return (
    <Routes>
      <Route index element={<OverviewView />} />
      <Route path="enrollments" element={<Placeholder title="Enrolments" />} />
      <Route path="staff" element={<Placeholder title="Staff" />} />
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
