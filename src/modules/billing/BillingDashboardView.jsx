/**
 * src/modules/billing/BillingDashboardView.jsx
 *
 * /app/admin/billing  — school_admin only
 *
 * Three panels:
 *   1. Term summary KPIs — expected, collected, outstanding, collection rate
 *   2. Class breakdown table — per-class outstanding balance
 *   3. Overdue list — pupils whose invoices are past due date
 *
 * The term/year selectors are sticky at the top. Changing either re-fetches
 * the underlying data — no page reload.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { Card, KpiCard } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import * as billingService from '@/services/billingService';
import * as classService from '@/services/classService';
import { cn } from '@/utils/cn';

const TERM_OPTIONS = [
  { value: 'term_1', label: 'First Term' },
  { value: 'term_2', label: 'Second Term' },
  { value: 'term_3', label: 'Third Term' },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1];

const ADMIN_NAV = [
  { to: '/app/admin',             label: 'Overview',   end: true },
  { to: '/app/admin/enrollments', label: 'Enrolments' },
  { to: '/app/admin/staff',       label: 'Staff'       },
  { to: '/app/admin/connections', label: 'Connections' },
  { to: '/app/admin/curriculum',  label: 'Curriculum'  },
  { to: '/app/admin/terms',       label: 'Terms'       },
  { to: '/app/admin/alerts',      label: 'Alerts'      },
  { to: '/app/admin/impact',      label: 'Impact'      },
  { to: '/app/admin/billing',     label: 'Billing'     },
];

export function BillingDashboardView() {
  const { schoolId } = useAuth();

  // Default to current term based on month heuristic
  const currentMonth = new Date().getMonth() + 1; // 1–12
  const defaultTerm =
    currentMonth >= 9  ? 'term_1' :
    currentMonth >= 1  && currentMonth <= 4 ? 'term_2' : 'term_3';

  const [term, setTerm] = useState(defaultTerm);
  const [year, setYear] = useState(CURRENT_YEAR);

  const summaryQ = useQuery({
    queryKey: ['billing', 'summary', schoolId, term, year],
    queryFn:  () => billingService.getBillingSummary({ schoolId, term, year }),
    enabled:  !!schoolId,
    staleTime: 60_000,
  });

  const invoicesQ = useQuery({
    queryKey: ['billing', 'invoices', schoolId, term, year],
    queryFn:  () => billingService.listTermInvoices({ schoolId, term, year }),
    enabled:  !!schoolId,
    staleTime: 60_000,
  });

  const classesQ = useQuery({
    queryKey: ['classes', schoolId],
    queryFn:  () => classService.listClasses({ schoolId }),
    enabled:  !!schoolId,
    staleTime: 300_000,
  });

  const s    = summaryQ.data ?? {};
  const invoices = invoicesQ.data ?? [];
  const classes  = classesQ.data ?? [];

  const overdue  = invoices.filter((i) => i.status === 'overdue');
  const partial  = invoices.filter((i) => i.status === 'partial');

  return (
    <AppShell title="Billing" navItems={ADMIN_NAV}>
      <div className="max-w-[980px]">

        {/* Header */}
        <div className="mb-s-7 flex flex-wrap items-end justify-between gap-s-5">
          <div>
            <div className="font-mono text-eyebrow uppercase text-gold-400">School billing</div>
            <h2 className="mt-s-2 font-display text-display-2 text-ink-0">Tuition & fees.</h2>
            <p className="mt-s-2 text-body text-ink-3 max-w-[54ch]">
              Track school fee collection across the term. Record payments at
              the gate and see which families need a follow-up.
            </p>
          </div>
          <div className="flex flex-wrap gap-s-4">
            <Link to="/app/admin/billing/invoice/new">
              <Button intent="primary" size="md">+ Create invoice</Button>
            </Link>
            <Link to="/app/admin/billing/bulk">
              <Button intent="ghost" size="md">Bulk invoice class</Button>
            </Link>
          </div>
        </div>

        {/* Term / year selectors */}
        <div className="flex flex-wrap gap-s-4 mb-s-8 p-s-4 bg-surface-2 border border-line-1 rounded-r-2">
          <div className="flex items-center gap-s-3">
            <span className="font-mono text-meta uppercase text-ink-3">Term</span>
            <div role="tablist" className="flex bg-surface-3 border border-line-2 rounded-full p-[3px]">
              {TERM_OPTIONS.map((t) => (
                <button
                  key={t.value}
                  role="tab"
                  aria-selected={term === t.value}
                  onClick={() => setTerm(t.value)}
                  className={cn(
                    'px-s-4 py-[5px] text-[12px] rounded-full transition-all duration-150 font-medium',
                    term === t.value
                      ? 'bg-gold-400 text-[#1a1305]'
                      : 'text-ink-2 hover:text-ink-0',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-s-3">
            <span className="font-mono text-meta uppercase text-ink-3">Year</span>
            <div role="tablist" className="flex bg-surface-3 border border-line-2 rounded-full p-[3px]">
              {YEAR_OPTIONS.map((y) => (
                <button
                  key={y}
                  role="tab"
                  aria-selected={year === y}
                  onClick={() => setYear(y)}
                  className={cn(
                    'px-s-4 py-[5px] text-[12px] rounded-full transition-all duration-150 font-medium',
                    year === y
                      ? 'bg-gold-400 text-[#1a1305]'
                      : 'text-ink-2 hover:text-ink-0',
                  )}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* KPI row */}
        {summaryQ.isLoading
          ? <div className="grid grid-cols-2 lg:grid-cols-4 gap-s-4 mb-s-8">
              {[1,2,3,4].map((i) => <div key={i} className="h-[100px] rounded-r-2 bg-surface-2 border border-line-2 animate-pulse"/>)}
            </div>
          : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-s-4 mb-s-8">
              <KpiCard
                label="Expected"
                value={billingService.fmtKobo(s.expected_kobo)}
                trend={`${s.total_invoices ?? 0} invoices`}
                trendIntent="neutral"
              />
              <KpiCard
                label="Collected"
                value={billingService.fmtKobo(s.collected_kobo)}
                trend={`${s.collection_rate_pct ?? 0}% of expected`}
                trendIntent={s.collection_rate_pct >= 80 ? 'positive' : s.collection_rate_pct >= 50 ? 'warning' : 'negative'}
              />
              <KpiCard
                label="Outstanding"
                value={billingService.fmtKobo(s.outstanding_kobo)}
                trend={`${s.partial_count ?? 0} partial · ${s.overdue_count ?? 0} overdue`}
                trendIntent={s.overdue_count > 0 ? 'negative' : 'neutral'}
              />
              <KpiCard
                label="Fully paid"
                value={String(s.paid_count ?? 0)}
                trend={`of ${s.total_invoices ?? 0} issued`}
                trendIntent="positive"
              />
            </div>
          )
        }

        {/* Overdue alert strip */}
        {overdue.length > 0 && (
          <div className="mb-s-6 p-s-5 bg-red-400/[0.06] border border-red-400/25 rounded-r-2 flex flex-wrap items-center gap-s-4">
            <Chip variant="red" dot>{overdue.length} overdue</Chip>
            <p className="text-[13.5px] text-ink-2">
              {overdue.length === 1
                ? `${overdue[0].pupilName} — ${billingService.fmtKobo(overdue[0].outstanding)} outstanding`
                : `${overdue.length} pupils have passed their payment due date. Review and follow up.`
              }
            </p>
            <Link to="/app/admin/billing/overdue" className="ml-auto">
              <Button intent="ghost" size="sm">View overdue →</Button>
            </Link>
          </div>
        )}

        {/* Invoice table */}
        <Card className="bg-surface-2 border-line-2 mb-s-6">
          <div className="flex items-center justify-between mb-s-5">
            <div className="font-mono text-eyebrow uppercase text-gold-400">
              {billingService.fmtTerm(term)} {year} — all invoices
            </div>
            <Link to={`/app/admin/billing/class`}>
              <Button intent="ghost" size="sm">View by class →</Button>
            </Link>
          </div>

          {invoicesQ.isLoading
            ? <div className="space-y-s-2">{[1,2,3,4].map((i) => <div key={i} className="h-10 rounded bg-surface-3 animate-pulse"/>)}</div>
            : invoices.length === 0
              ? (
                <div className="text-center py-s-9">
                  <p className="text-body text-ink-3">No invoices yet for this term.</p>
                  <Link to="/app/admin/billing/invoice/new">
                    <Button intent="ghost" size="sm" className="mt-s-4">Create the first invoice →</Button>
                  </Link>
                </div>
              )
              : (
                <div className="overflow-x-auto -mx-s-5">
                  <table className="w-full text-[13.5px]">
                    <thead>
                      <tr className="border-b border-line-2">
                        <th className="text-left px-s-5 pb-s-3 font-mono text-meta text-ink-3 uppercase tracking-[0.1em]">Pupil</th>
                        <th className="text-left px-s-3 pb-s-3 font-mono text-meta text-ink-3 uppercase tracking-[0.1em]">Class</th>
                        <th className="text-right px-s-3 pb-s-3 font-mono text-meta text-ink-3 uppercase tracking-[0.1em]">Total</th>
                        <th className="text-right px-s-3 pb-s-3 font-mono text-meta text-ink-3 uppercase tracking-[0.1em]">Paid</th>
                        <th className="text-right px-s-3 pb-s-3 font-mono text-meta text-ink-3 uppercase tracking-[0.1em]">Balance</th>
                        <th className="px-s-5 pb-s-3 font-mono text-meta text-ink-3 uppercase tracking-[0.1em]">Status</th>
                        <th className="px-s-3 pb-s-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((inv) => (
                        <InvoiceRow key={inv.id} invoice={inv} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )
          }
        </Card>

        {/* Partial payments strip */}
        {partial.length > 0 && (
          <Card className="bg-surface-2 border-line-2">
            <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-4">Partial payments</div>
            <div className="space-y-s-2">
              {partial.slice(0, 5).map((inv) => (
                <div key={inv.id} className="flex items-center gap-s-4 py-s-2 border-b border-line-2 last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] text-ink-1 truncate">{inv.pupilName}</div>
                    <div className="font-mono text-meta text-ink-3">{inv.className}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-[13px] text-ink-0">{billingService.fmtKobo(inv.outstanding)} remaining</div>
                    <div className="font-mono text-meta text-ink-3">{billingService.fmtKobo(inv.paid_kobo)} paid</div>
                  </div>
                  <Link to={`/app/admin/billing/invoice/${inv.id}`}>
                    <Button intent="ghost" size="sm">Record payment</Button>
                  </Link>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

function InvoiceRow({ invoice: inv }) {
  const statusColor = {
    paid:      'green',
    partial:   'amber',
    overdue:   'red',
    issued:    'default',
    draft:     'default',
    cancelled: 'default',
  }[inv.status] ?? 'default';

  return (
    <tr className="border-b border-line-2 last:border-0 hover:bg-surface-3 transition-colors">
      <td className="px-s-5 py-s-3">
        <div className="text-ink-1 font-medium">{inv.pupilName}</div>
        {inv.pupilCode && <div className="font-mono text-meta text-ink-3">{inv.pupilCode}</div>}
      </td>
      <td className="px-s-3 py-s-3 text-ink-2">{inv.className}</td>
      <td className="px-s-3 py-s-3 text-right font-mono text-ink-0 tabular-nums">{billingService.fmtKobo(inv.total_kobo)}</td>
      <td className="px-s-3 py-s-3 text-right font-mono text-ink-2 tabular-nums">{billingService.fmtKobo(inv.paid_kobo)}</td>
      <td className="px-s-3 py-s-3 text-right font-mono tabular-nums">
        <span className={inv.outstanding > 0 ? 'text-red-400' : 'text-green-400'}>
          {billingService.fmtKobo(inv.outstanding)}
        </span>
      </td>
      <td className="px-s-5 py-s-3">
        <Chip variant={statusColor} dot>{inv.status}</Chip>
      </td>
      <td className="px-s-3 py-s-3">
        <Link to={`/app/admin/billing/invoice/${inv.id}`}>
          <Button intent="ghost" size="sm">Open →</Button>
        </Link>
      </td>
    </tr>
  );
}
