/**
 * src/modules/billing/InvoiceEditorView.jsx
 *
 * /app/admin/billing/invoice/new        — create a new invoice
 * /app/admin/billing/invoice/:invoiceId — view + edit existing invoice
 *
 * TWO MODES
 * ─────────
 * CREATE mode (/new):
 *   - Pupil search / class picker
 *   - Line item builder (description + amount)
 *   - Due date (optional)
 *   - Save as draft → then Issue
 *
 * VIEW/EDIT mode (/:invoiceId):
 *   - Shows full invoice detail (items + payments)
 *   - Issue button (if draft)
 *   - "Record payment" inline form (cash / transfer / POS)
 *   - Payment history list with reverse button
 *
 * STATE MACHINE: draft → issued → partial | overdue → paid
 * The trigger in migration 0011 handles status transitions automatically.
 */

import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import * as billingService from '@/services/billingService';
import { cn } from '@/utils/cn';
import { friendlyError } from '@/utils/friendlyError';

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

const PAYMENT_METHODS = [
  { value: 'cash',          label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'pos',           label: 'POS / card' },
  { value: 'other',         label: 'Other' },
];

const CURRENT_YEAR  = new Date().getFullYear();
const TERM_OPTIONS  = [
  { value: 'term_1', label: 'First Term'  },
  { value: 'term_2', label: 'Second Term' },
  { value: 'term_3', label: 'Third Term'  },
];

// ── Router entry — splits create vs. view modes ───────────────────────────────

export function InvoiceEditorView() {
  const { invoiceId } = useParams();
  return invoiceId === 'new' || !invoiceId
    ? <CreateInvoiceView />
    : <ViewInvoiceView invoiceId={invoiceId} />;
}

// ── CREATE mode ───────────────────────────────────────────────────────────────

function CreateInvoiceView() {
  const { schoolId } = useAuth();
  const navigate     = useNavigate();
  const qc           = useQueryClient();

  const [pupilQuery, setPupilQuery] = useState('');
  const [selectedPupil, setSelectedPupil] = useState(null);
  const [term,    setTerm]    = useState('term_1');
  const [year,    setYear]    = useState(CURRENT_YEAR);
  const [dueDate, setDueDate] = useState('');
  const [items,   setItems]   = useState([{ description: 'Tuition Fee', amount: '' }]);
  const [notes,   setNotes]   = useState('');
  const [error,   setError]   = useState(null);

  // Pupil search
  const pupilQ = useQuery({
    queryKey: ['pupils', 'search', schoolId, pupilQuery],
    queryFn: async () => {
      if (!pupilQuery.trim() || pupilQuery.length < 2) return [];
      const { data, error } = await supabase
        .from('pupils')
        .select('id, full_name, pupil_code, classes(name)')
        .eq('school_id', schoolId)
        .ilike('full_name', `%${pupilQuery}%`)
        .limit(8);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: !!schoolId && pupilQuery.length >= 2,
    staleTime: 0,
  });

  const createMut = useMutation({
    mutationFn: () => {
      const parsedItems = items.map((it) => ({
        description: it.description.trim(),
        amountKobo:  billingService.koboFromNaira(it.amount),
      }));
      if (parsedItems.some((it) => !it.description)) throw new Error('All line items need a description.');
      if (parsedItems.some((it) => it.amountKobo <= 0)) throw new Error('All amounts must be greater than zero.');

      return billingService.createInvoice({
        schoolId,
        pupilId:  selectedPupil.id,
        classId:  selectedPupil.class_id ?? null,
        term, year: Number(year),
        dueDate:  dueDate || null,
        items:    parsedItems,
        notes:    notes || null,
      });
    },
    onSuccess: (inv) => {
      qc.invalidateQueries({ queryKey: ['billing'] });
      navigate(`/app/admin/billing/invoice/${inv.id}`);
    },
    onError: (e) => setError(friendlyError(e)),
  });

  const addItem = () => setItems((prev) => [...prev, { description: '', amount: '' }]);
  const removeItem = (i) => setItems((prev) => prev.filter((_, idx) => idx !== i));
  const updateItem = (i, field, val) => setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, [field]: val } : it));

  const total = items.reduce((sum, it) => {
    try { return sum + billingService.koboFromNaira(it.amount); }
    catch { return sum; }
  }, 0);

  return (
    <AppShell title="New invoice" navItems={ADMIN_NAV}>
      <div className="max-w-[680px]">
        <div className="mb-s-7">
          <div className="font-mono text-eyebrow uppercase text-gold-400">Billing</div>
          <h2 className="mt-s-2 font-display text-display-2 text-ink-0">Create invoice.</h2>
          <p className="mt-s-2 text-body text-ink-3 max-w-[52ch]">
            Choose a pupil, add line items, then save as draft. Issue the
            invoice when you're ready to make it visible to parents.
          </p>
        </div>

        <div className="space-y-s-5">
          {/* Pupil selector */}
          <Card className="bg-surface-2 border-line-2">
            <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-4">Pupil</div>
            {selectedPupil
              ? (
                <div className="flex items-center gap-s-4">
                  <div className="flex-1">
                    <div className="text-ink-1 font-medium">{selectedPupil.full_name}</div>
                    <div className="font-mono text-meta text-ink-3">
                      {selectedPupil.pupil_code ?? ''} · {selectedPupil.classes?.name ?? 'No class'}
                    </div>
                  </div>
                  <Button intent="ghost" size="sm" onClick={() => setSelectedPupil(null)}>Change</Button>
                </div>
              )
              : (
                <div className="relative">
                  <input
                    type="text"
                    value={pupilQuery}
                    onChange={(e) => setPupilQuery(e.target.value)}
                    placeholder="Search pupil by name…"
                    className="w-full bg-surface-3 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[15px] text-ink-0 outline-none focus:border-gold-400"
                  />
                  {pupilQ.data && pupilQ.data.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-s-1 bg-surface-3 border border-line-2 rounded-r-2 z-10 shadow-lift">
                      {pupilQ.data.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => { setSelectedPupil(p); setPupilQuery(''); }}
                          className="w-full text-left px-s-4 py-s-3 hover:bg-surface-4 text-[13.5px] text-ink-1 border-b border-line-2 last:border-0"
                        >
                          <div className="font-medium">{p.full_name}</div>
                          <div className="font-mono text-meta text-ink-3">{p.classes?.name ?? 'No class'}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  {pupilQ.data?.length === 0 && pupilQuery.length >= 2 && !pupilQ.isLoading && (
                    <p className="mt-s-2 font-mono text-meta text-ink-3">No pupils found for "{pupilQuery}".</p>
                  )}
                </div>
              )
            }
          </Card>

          {/* Term + year */}
          <Card className="bg-surface-2 border-line-2">
            <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-4">Term</div>
            <div className="flex flex-wrap gap-s-4">
              <div className="flex-1 min-w-[140px]">
                <label className="block font-mono text-meta text-ink-3 mb-s-2">Term</label>
                <select
                  value={term} onChange={(e) => setTerm(e.target.value)}
                  className="w-full bg-surface-3 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[15px] text-ink-0 outline-none focus:border-gold-400"
                >
                  {TERM_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="flex-1 min-w-[100px]">
                <label className="block font-mono text-meta text-ink-3 mb-s-2">Year</label>
                <select
                  value={year} onChange={(e) => setYear(Number(e.target.value))}
                  className="w-full bg-surface-3 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[15px] text-ink-0 outline-none focus:border-gold-400"
                >
                  {[CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div className="flex-1 min-w-[140px]">
                <label className="block font-mono text-meta text-ink-3 mb-s-2">Due date (optional)</label>
                <input
                  type="date" value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full bg-surface-3 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[15px] text-ink-0 outline-none focus:border-gold-400"
                />
              </div>
            </div>
          </Card>

          {/* Line items */}
          <Card className="bg-surface-2 border-line-2">
            <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-4">Line items</div>
            <div className="space-y-s-3">
              {items.map((item, i) => (
                <div key={i} className="grid grid-cols-[1fr_140px_32px] gap-s-2 items-center">
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => updateItem(i, 'description', e.target.value)}
                    placeholder="Description (e.g. Tuition Fee)"
                    className="bg-surface-3 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[14px] text-ink-0 outline-none focus:border-gold-400"
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    value={item.amount}
                    onChange={(e) => updateItem(i, 'amount', e.target.value)}
                    placeholder="₦ Amount"
                    className="bg-surface-3 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[14px] text-ink-0 outline-none focus:border-gold-400 font-mono"
                  />
                  <button
                    onClick={() => removeItem(i)}
                    disabled={items.length === 1}
                    className="text-ink-3 hover:text-red-400 disabled:opacity-30 transition-colors"
                    aria-label="Remove item"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                onClick={addItem}
                className="mt-s-2 text-[13px] text-gold-400 hover:text-gold-200 font-mono transition-colors"
              >
                + Add line item
              </button>
            </div>

            {total > 0 && (
              <div className="mt-s-5 pt-s-4 border-t border-line-1 flex justify-between items-center">
                <span className="font-mono text-meta uppercase text-ink-3">Total</span>
                <span className="font-display text-[22px] text-ink-0">{billingService.fmtKobo(total)}</span>
              </div>
            )}
          </Card>

          {/* Notes */}
          <Card className="bg-surface-2 border-line-2">
            <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-3">Notes (optional)</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="E.g. Includes uniform deposit of ₦5,000"
              className="w-full bg-surface-3 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[14px] text-ink-0 outline-none focus:border-gold-400 resize-none"
              maxLength={500}
            />
          </Card>

          {error && (
            <div className="text-[13px] text-red-400 bg-red-400/10 border border-red-400/25 rounded-r-2 px-s-4 py-s-3">
              {error}
            </div>
          )}

          <div className="flex gap-s-4">
            <Button
              intent="primary" size="md"
              onClick={() => { setError(null); createMut.mutate(); }}
              isLoading={createMut.isPending}
              disabled={!selectedPupil || items.every((i) => !i.amount)}
            >
              Save as draft
            </Button>
            <Link to="/app/admin/billing">
              <Button intent="ghost" size="md">Cancel</Button>
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

// ── VIEW/EDIT mode ────────────────────────────────────────────────────────────

function ViewInvoiceView({ invoiceId }) {
  const { schoolId } = useAuth();
  const qc           = useQueryClient();

  const [payAmt,    setPayAmt]    = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [payDate,   setPayDate]   = useState(new Date().toISOString().slice(0, 10));
  const [payNotes,  setPayNotes]  = useState('');
  const [payError,  setPayError]  = useState(null);

  const invQ = useQuery({
    queryKey: ['billing', 'invoice', invoiceId],
    queryFn:  () => billingService.getInvoiceDetail(invoiceId),
    enabled:  !!invoiceId,
    staleTime: 0,
  });

  const issueMut = useMutation({
    mutationFn: () => billingService.issueInvoice(invoiceId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billing'] });
      invQ.refetch();
    },
  });

  const payMut = useMutation({
    mutationFn: () => billingService.recordPayment({
      invoiceId,
      schoolId,
      amountKobo: billingService.koboFromNaira(payAmt),
      method: payMethod,
      paymentDate: payDate,
      notes: payNotes || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billing'] });
      invQ.refetch();
      setPayAmt(''); setPayNotes(''); setPayError(null);
    },
    onError: (e) => setPayError(friendlyError(e)),
  });

  const reverseMut = useMutation({
    mutationFn: (pid) => billingService.reversePayment(pid),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['billing'] }); invQ.refetch(); },
  });

  const inv = invQ.data;

  if (invQ.isLoading) {
    return (
      <AppShell title="Invoice" navItems={ADMIN_NAV}>
        <div className="space-y-s-4 max-w-[680px]">
          {[1,2,3].map((i) => <div key={i} className="h-28 rounded-r-2 bg-surface-2 border border-line-2 animate-pulse"/>)}
        </div>
      </AppShell>
    );
  }

  if (!inv) {
    return (
      <AppShell title="Invoice" navItems={ADMIN_NAV}>
        <Card><p className="text-body text-ink-2">Invoice not found.</p></Card>
      </AppShell>
    );
  }

  const outstanding = (inv.total_kobo ?? 0) - (inv.paid_kobo ?? 0);
  const items    = inv.school_invoice_items ?? [];
  const payments = inv.school_invoice_payments ?? [];
  const statusColor = { paid: 'green', partial: 'amber', overdue: 'red', issued: 'default', draft: 'default' }[inv.status] ?? 'default';

  return (
    <AppShell title="Invoice" navItems={ADMIN_NAV}>
      <div className="max-w-[680px] space-y-s-5">
        <div className="flex flex-wrap items-center gap-s-4 mb-s-2">
          <Link to="/app/admin/billing" className="font-mono text-meta text-gold-400 hover:text-gold-200">← Billing</Link>
        </div>

        {/* Header card */}
        <Card className="bg-surface-2 border-line-2">
          <div className="flex flex-wrap items-start gap-s-5 justify-between">
            <div>
              <div className="font-mono text-eyebrow uppercase text-gold-400">
                {billingService.fmtTerm(inv.term)} {inv.academic_year}
              </div>
              <h2 className="mt-s-2 font-display text-display-2 text-ink-0">
                {inv.pupils?.full_name ?? 'Pupil'}
              </h2>
              <div className="mt-s-1 font-mono text-meta text-ink-3">
                {inv.pupils?.pupil_code ?? ''} · {inv.classes?.name ?? 'No class'}
              </div>
            </div>
            <Chip variant={statusColor} dot>{inv.status}</Chip>
          </div>

          <div className="mt-s-5 grid grid-cols-3 gap-s-5 pt-s-5 border-t border-line-1">
            <div>
              <div className="font-mono text-meta text-ink-3">Total</div>
              <div className="font-display text-[22px] text-ink-0 mt-s-1">{billingService.fmtKobo(inv.total_kobo)}</div>
            </div>
            <div>
              <div className="font-mono text-meta text-ink-3">Paid</div>
              <div className="font-display text-[22px] text-green-400 mt-s-1">{billingService.fmtKobo(inv.paid_kobo)}</div>
            </div>
            <div>
              <div className="font-mono text-meta text-ink-3">Outstanding</div>
              <div className={cn('font-display text-[22px] mt-s-1', outstanding > 0 ? 'text-red-400' : 'text-ink-3')}>
                {billingService.fmtKobo(outstanding)}
              </div>
            </div>
          </div>

          {inv.due_date && (
            <div className="mt-s-3 font-mono text-meta text-ink-3">
              Due {new Date(inv.due_date).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          )}

          {inv.status === 'draft' && (
            <div className="mt-s-5 pt-s-4 border-t border-line-1">
              <Button
                intent="primary" size="md"
                onClick={() => issueMut.mutate()}
                isLoading={issueMut.isPending}
              >
                Issue invoice — make visible to parent
              </Button>
            </div>
          )}
        </Card>

        {/* Line items */}
        <Card className="bg-surface-2 border-line-2">
          <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-4">Line items</div>
          {items.length === 0
            ? <p className="text-body text-ink-3">No line items.</p>
            : (
              <div className="space-y-s-1">
                {[...items].sort((a, b) => a.sort_order - b.sort_order).map((item) => (
                  <div key={item.id} className="flex justify-between items-center py-s-2 border-b border-line-2 last:border-0 text-[13.5px]">
                    <span className="text-ink-1">{item.description}</span>
                    <span className="font-mono text-ink-0 tabular-nums">{billingService.fmtKobo(item.amount_kobo)}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-s-3 font-display text-[18px]">
                  <span className="text-ink-3">Total</span>
                  <span className="text-ink-0">{billingService.fmtKobo(inv.total_kobo)}</span>
                </div>
              </div>
            )
          }
        </Card>

        {/* Record payment — only when there's something outstanding and invoice is issued */}
        {outstanding > 0 && inv.status !== 'draft' && inv.status !== 'cancelled' && (
          <Card className="bg-surface-2 border-line-2">
            <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-4">Record payment</div>
            <div className="grid grid-cols-2 gap-s-3 mb-s-3">
              <div>
                <label className="block font-mono text-meta text-ink-3 mb-s-1">Amount (₦)</label>
                <input
                  type="text" inputMode="decimal"
                  value={payAmt} onChange={(e) => setPayAmt(e.target.value)}
                  placeholder={`Max ${billingService.fmtKobo(outstanding)}`}
                  className="w-full bg-surface-3 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[15px] text-ink-0 outline-none focus:border-gold-400 font-mono"
                />
              </div>
              <div>
                <label className="block font-mono text-meta text-ink-3 mb-s-1">Method</label>
                <select
                  value={payMethod} onChange={(e) => setPayMethod(e.target.value)}
                  className="w-full bg-surface-3 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[15px] text-ink-0 outline-none focus:border-gold-400"
                >
                  {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-s-3 mb-s-3">
              <div>
                <label className="block font-mono text-meta text-ink-3 mb-s-1">Date</label>
                <input
                  type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)}
                  className="w-full bg-surface-3 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[15px] text-ink-0 outline-none focus:border-gold-400"
                />
              </div>
              <div>
                <label className="block font-mono text-meta text-ink-3 mb-s-1">Notes (optional)</label>
                <input
                  type="text" value={payNotes} onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="Receipt no., reference…"
                  className="w-full bg-surface-3 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[15px] text-ink-0 outline-none focus:border-gold-400"
                />
              </div>
            </div>
            {payError && <div className="mb-s-3 text-[13px] text-red-400">{payError}</div>}
            <Button
              intent="primary" size="md"
              onClick={() => { setPayError(null); payMut.mutate(); }}
              isLoading={payMut.isPending}
              disabled={!payAmt}
            >
              Confirm payment
            </Button>
          </Card>
        )}

        {/* Payment history */}
        {payments.length > 0 && (
          <Card className="bg-surface-2 border-line-2">
            <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-4">Payment history</div>
            <div className="space-y-s-1">
              {[...payments].sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date)).map((p) => (
                <div key={p.id} className="flex items-center gap-s-4 py-s-3 border-b border-line-2 last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] text-ink-1">
                      {billingService.fmtKobo(p.amount_kobo)}
                      <span className="ml-s-2 font-mono text-meta text-ink-3">via {p.method}</span>
                    </div>
                    <div className="font-mono text-meta text-ink-3">
                      {new Date(p.payment_date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {p.notes && <> · {p.notes}</>}
                    </div>
                  </div>
                  <Chip variant={p.status === 'confirmed' ? 'green' : p.status === 'reversed' ? 'red' : 'amber'} dot>
                    {p.status}
                  </Chip>
                  {p.status === 'confirmed' && (
                    <button
                      onClick={() => reverseMut.mutate(p.id)}
                      className="font-mono text-meta text-ink-3 hover:text-red-400 transition-colors"
                    >
                      Reverse
                    </button>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
