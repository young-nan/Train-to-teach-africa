/**
 * src/modules/billing/ParentBillingView.jsx
 *
 * /app/parent/billing
 *
 * Shows every issued invoice for a parent's linked children.
 * Parents cannot pay directly here yet (Paystack integration for school
 * fees is v2 — it requires the school to be onboarded with their own
 * Paystack account or a split-payment setup). For now: see what you owe,
 * contact the school to pay.
 *
 * What parents see:
 *   - Each child as a tab
 *   - Per-term invoice with status chip (paid / partial / overdue / issued)
 *   - Line item breakdown on expand
 *   - Payment history on expand
 *   - Outstanding balance prominently displayed if > 0
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import * as billingService from '@/services/billingService';
import * as simsService from '@/services/simsService';
import { cn } from '@/utils/cn';

const PARENT_NAV = [
  { to: '/app/parent',          label: 'Tonight',  end: true },
  { to: '/app/parent/children', label: 'Children'             },
  { to: '/app/parent/lessons',  label: 'Lessons'              },
  { to: '/app/parent/reports',  label: 'Reports'              },
  { to: '/app/parent/billing',  label: 'Fees'                 },
  { to: '/app/parent/subscribe', label: 'Subscribe'           },
];

const STATUS_COLOR = {
  paid:    'green',
  partial: 'amber',
  overdue: 'red',
  issued:  'default',
};

export function ParentBillingView() {
  const { profile } = useAuth();
  const [activeChild, setActiveChild] = useState(null);

  // Load children linked to this parent
  const childrenQ = useQuery({
    queryKey: ['parent', 'children'],
    queryFn:  () => simsService.getMyChildren(),
    staleTime: 300_000,
  });

  const children = childrenQ.data ?? [];

  // Default to first child once loaded
  const selectedId = activeChild ?? children[0]?.id ?? null;
  const selectedChild = children.find((c) => c.id === selectedId);

  return (
    <AppShell title="Fees" navItems={PARENT_NAV}>
      <div className="max-w-[820px]">
        <div className="mb-s-7">
          <div className="font-mono text-eyebrow uppercase text-gold-400">School fees</div>
          <h2 className="mt-s-2 font-display text-display-2 text-ink-0">
            Fee invoices.
          </h2>
          <p className="mt-s-2 text-body text-ink-3 max-w-[58ch]">
            Invoices from your school. To make a payment, please contact the
            school office directly.
          </p>
        </div>

        {childrenQ.isLoading && (
          <div className="space-y-s-4">
            {[1,2].map((i) => <div key={i} className="h-28 rounded-r-2 bg-surface-2 animate-pulse"/>)}
          </div>
        )}

        {!childrenQ.isLoading && children.length === 0 && (
          <Card className="bg-surface-2 border-line-2 text-center">
            <p className="text-body text-ink-2">No children linked to your account yet.</p>
          </Card>
        )}

        {children.length > 0 && (
          <>
            {/* Child tabs */}
            {children.length > 1 && (
              <div className="flex flex-wrap gap-s-2 mb-s-6">
                {children.map((child) => (
                  <button
                    key={child.id}
                    onClick={() => setActiveChild(child.id)}
                    className={cn(
                      'px-s-5 py-s-2 rounded-full text-[13px] font-medium border transition-all duration-150',
                      child.id === selectedId
                        ? 'bg-gold-400/15 border-gold-400/40 text-gold-200'
                        : 'bg-surface-2 border-line-2 text-ink-2 hover:text-ink-1',
                    )}
                  >
                    {child.full_name?.split(' ')[0] ?? child.full_name}
                  </button>
                ))}
              </div>
            )}

            {/* Invoice list for selected child */}
            {selectedId && <ChildInvoices pupilId={selectedId} child={selectedChild} />}
          </>
        )}
      </div>
    </AppShell>
  );
}

function ChildInvoices({ pupilId, child }) {
  const [expanded, setExpanded] = useState(null);

  const invQ = useQuery({
    queryKey: ['parent', 'invoices', pupilId],
    queryFn:  () => billingService.getMyChildInvoices(pupilId),
    enabled:  !!pupilId,
    staleTime: 60_000,
  });

  const invoices = invQ.data ?? [];

  const totalOutstanding = invoices.reduce(
    (sum, inv) => sum + Math.max(0, (inv.total_kobo ?? 0) - (inv.paid_kobo ?? 0)),
    0,
  );

  if (invQ.isLoading) {
    return <div className="space-y-s-3">{[1,2].map((i) => <div key={i} className="h-20 rounded-r-2 bg-surface-2 animate-pulse"/>)}</div>;
  }

  if (invoices.length === 0) {
    return (
      <Card className="bg-surface-2 border-line-2 text-center">
        <p className="text-body text-ink-2">No fee invoices for {child?.full_name ?? 'this child'} yet.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-s-4">
      {/* Outstanding summary */}
      {totalOutstanding > 0 && (
        <div className="p-s-5 bg-amber-400/[0.06] border border-amber-400/25 rounded-r-2">
          <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-1">Outstanding balance</div>
          <div className="font-display text-[28px] text-ink-0">{billingService.fmtKobo(totalOutstanding)}</div>
          <p className="mt-s-2 text-body text-ink-3 text-[13.5px]">
            Contact the school office to arrange payment.
          </p>
        </div>
      )}

      {/* Invoice cards */}
      {invoices.map((inv) => {
        const outstanding = Math.max(0, (inv.total_kobo ?? 0) - (inv.paid_kobo ?? 0));
        const isOpen      = expanded === inv.id;
        const items       = [...(inv.school_invoice_items ?? [])].sort((a, b) => a.sort_order - b.sort_order);

        return (
          <Card key={inv.id} className="bg-surface-2 border-line-2">
            <div
              className="flex items-start justify-between gap-s-4 cursor-pointer"
              onClick={() => setExpanded(isOpen ? null : inv.id)}
            >
              <div>
                <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-1">
                  {billingService.fmtTerm(inv.term)} {inv.academic_year}
                </div>
                <div className="flex items-baseline gap-s-3">
                  <span className="font-display text-[22px] text-ink-0">{billingService.fmtKobo(inv.total_kobo)}</span>
                  {outstanding > 0 && (
                    <span className="font-mono text-meta text-red-400">{billingService.fmtKobo(outstanding)} outstanding</span>
                  )}
                </div>
                {inv.due_date && (
                  <div className="mt-s-1 font-mono text-meta text-ink-3">
                    Due {new Date(inv.due_date).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-s-3">
                <Chip variant={STATUS_COLOR[inv.status] ?? 'default'} dot>{inv.status}</Chip>
                <span className="font-mono text-meta text-ink-3">{isOpen ? '▲' : '▼'}</span>
              </div>
            </div>

            {isOpen && (
              <div className="mt-s-5 pt-s-4 border-t border-line-1 space-y-s-4">
                {/* Line items */}
                {items.length > 0 && (
                  <div>
                    <div className="font-mono text-meta text-ink-3 mb-s-2">WHAT'S INCLUDED</div>
                    {items.map((item) => (
                      <div key={item.id} className="flex justify-between text-[13.5px] py-s-1 border-b border-line-2 last:border-0">
                        <span className="text-ink-2">{item.description}</span>
                        <span className="font-mono text-ink-0 tabular-nums">{billingService.fmtKobo(item.amount_kobo)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Notes */}
                {inv.notes && (
                  <p className="text-[13.5px] text-ink-3 italic">{inv.notes}</p>
                )}

                {/* Paid amount + progress bar */}
                {inv.paid_kobo > 0 && (
                  <div>
                    <div className="font-mono text-meta text-ink-3 mb-s-2">PAYMENT PROGRESS</div>
                    <div className="flex justify-between text-[13.5px] mb-s-2">
                      <span className="text-ink-2">Paid</span>
                      <span className="font-mono text-green-400">{billingService.fmtKobo(inv.paid_kobo)}</span>
                    </div>
                    <div className="w-full bg-surface-3 rounded-full h-[6px]">
                      <div
                        className="bg-green-400 h-[6px] rounded-full transition-all"
                        style={{ width: `${Math.min(100, Math.round((inv.paid_kobo / (inv.total_kobo || 1)) * 100))}%` }}
                      />
                    </div>
                  </div>
                )}

                {outstanding > 0 && (
                  <div className="p-s-4 bg-surface-3 rounded-r-2 text-[13.5px] text-ink-3">
                    To pay the remaining {billingService.fmtKobo(outstanding)}, please contact
                    the school office or bring payment directly to the school.
                  </div>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
