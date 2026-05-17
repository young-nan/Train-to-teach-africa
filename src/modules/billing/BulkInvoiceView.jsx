/**
 * src/modules/billing/BulkInvoiceView.jsx
 *
 * /app/admin/billing/bulk
 *
 * Generate one invoice per pupil for an entire class.
 * Admin picks a class, sets line items (e.g. "Tuition Fee ₦25,000"),
 * and clicks "Generate N invoices". Each pupil gets a draft invoice.
 * Pupils who already have an invoice for the term are skipped (not errored).
 *
 * Pattern: same multi-step confirm flow as PupilImportView.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import * as billingService from '@/services/billingService';
import * as classService from '@/services/classService';
import { supabase } from '@/lib/supabase';
import { friendlyError } from '@/utils/friendlyError';

const CURRENT_YEAR = new Date().getFullYear();
const TERM_OPTIONS = [
  { value: 'term_1', label: 'First Term'  },
  { value: 'term_2', label: 'Second Term' },
  { value: 'term_3', label: 'Third Term'  },
];

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

export function BulkInvoiceView() {
  const { schoolId } = useAuth();
  const qc           = useQueryClient();
  const navigate     = useNavigate();

  const [classId, setClassId]   = useState('');
  const [term,    setTerm]      = useState('term_1');
  const [year,    setYear]      = useState(CURRENT_YEAR);
  const [dueDate, setDueDate]   = useState('');
  const [items,   setItems]     = useState([{ description: 'Tuition Fee', amount: '' }]);
  const [result,  setResult]    = useState(null); // { created, skipped, errors }
  const [error,   setError]     = useState(null);

  const classesQ = useQuery({
    queryKey: ['classes', schoolId],
    queryFn:  () => classService.listClasses({ schoolId }),
    enabled:  !!schoolId,
    staleTime: 300_000,
  });

  // Preview: count pupils in the selected class
  const pupilCountQ = useQuery({
    queryKey: ['pupils', 'count', classId],
    queryFn: async () => {
      if (!classId) return 0;
      const { count } = await supabase
        .from('pupils')
        .select('id', { count: 'exact', head: true })
        .eq('class_id', classId)
        .eq('school_id', schoolId);
      return count ?? 0;
    },
    enabled: !!classId && !!schoolId,
    staleTime: 30_000,
  });

  const addItem    = () => setItems((p) => [...p, { description: '', amount: '' }]);
  const removeItem = (i) => setItems((p) => p.filter((_, idx) => idx !== i));
  const updateItem = (i, field, val) =>
    setItems((p) => p.map((it, idx) => idx === i ? { ...it, [field]: val } : it));

  const total = items.reduce((sum, it) => {
    try { return sum + billingService.koboFromNaira(it.amount); } catch { return sum; }
  }, 0);

  const bulkMut = useMutation({
    mutationFn: () => {
      if (!classId) throw new Error('Please select a class.');
      const parsedItems = items.map((it) => ({
        description: it.description.trim(),
        amountKobo:  billingService.koboFromNaira(it.amount),
      }));
      if (parsedItems.some((it) => !it.description)) throw new Error('All line items need a description.');
      if (parsedItems.some((it) => it.amountKobo <= 0)) throw new Error('All amounts must be greater than zero.');

      return billingService.bulkCreateClassInvoices({
        schoolId,
        classId,
        term,
        year: Number(year),
        dueDate: dueDate || null,
        items: parsedItems,
      });
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['billing'] });
      setResult(res);
      setError(null);
    },
    onError: (e) => setError(friendlyError(e)),
  });

  const selectedClass = classesQ.data?.find((c) => c.id === classId);
  const pupilCount    = pupilCountQ.data ?? 0;

  // ── Result screen ──────────────────────────────────────────────────────────
  if (result) {
    return (
      <AppShell title="Bulk invoice" navItems={ADMIN_NAV}>
        <div className="max-w-[600px]">
          <Card className="bg-surface-2 border-line-2 text-center">
            <Chip variant={result.errors.length > 0 ? 'amber' : 'green'} dot>
              {result.errors.length > 0 ? 'Completed with warnings' : 'Done'}
            </Chip>
            <h2 className="mt-s-5 font-display text-display-2 text-ink-0">
              {result.created} invoice{result.created !== 1 ? 's' : ''} created.
            </h2>
            {result.skipped > 0 && (
              <p className="mt-s-3 text-body text-ink-2">
                {result.skipped} pupil{result.skipped !== 1 ? 's' : ''} already had an invoice and were skipped.
              </p>
            )}
            {result.errors.length > 0 && (
              <div className="mt-s-4 text-left bg-red-400/[0.06] border border-red-400/25 rounded-r-2 p-s-4">
                <div className="font-mono text-eyebrow text-red-400 mb-s-2">Errors</div>
                {result.errors.map((e, i) => <p key={i} className="text-[13px] text-red-400">{e}</p>)}
              </div>
            )}
            <div className="mt-s-7 flex justify-center gap-s-4">
              <Link to="/app/admin/billing">
                <Button intent="primary" size="md">Back to billing →</Button>
              </Link>
              <Button intent="ghost" size="md" onClick={() => { setResult(null); setItems([{ description: 'Tuition Fee', amount: '' }]); }}>
                Create another batch
              </Button>
            </div>
          </Card>
        </div>
      </AppShell>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────────
  return (
    <AppShell title="Bulk invoice" navItems={ADMIN_NAV}>
      <div className="max-w-[680px]">
        <div className="mb-s-7">
          <div className="font-mono text-eyebrow uppercase text-gold-400">Billing</div>
          <h2 className="mt-s-2 font-display text-display-2 text-ink-0">Bulk invoice a class.</h2>
          <p className="mt-s-2 text-body text-ink-3 max-w-[52ch]">
            One invoice per pupil — the same line items for every pupil in the
            class. Existing invoices are skipped, not overwritten.
          </p>
        </div>

        <div className="space-y-s-5">
          {/* Class selector */}
          <Card className="bg-surface-2 border-line-2">
            <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-4">Class</div>
            {classesQ.isLoading
              ? <div className="h-10 rounded bg-surface-3 animate-pulse"/>
              : (
                <select
                  value={classId} onChange={(e) => setClassId(e.target.value)}
                  className="w-full bg-surface-3 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[15px] text-ink-0 outline-none focus:border-gold-400"
                >
                  <option value="">Select a class…</option>
                  {(classesQ.data ?? []).map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.pupil_count} pupils)</option>
                  ))}
                </select>
              )
            }
            {classId && pupilCountQ.data !== undefined && (
              <p className="mt-s-3 font-mono text-meta text-ink-3">
                {pupilCount} pupil{pupilCount !== 1 ? 's' : ''} will receive an invoice.
              </p>
            )}
          </Card>

          {/* Term / year / due date */}
          <Card className="bg-surface-2 border-line-2">
            <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-4">Term</div>
            <div className="flex flex-wrap gap-s-3">
              <div className="flex-1 min-w-[130px]">
                <label className="block font-mono text-meta text-ink-3 mb-s-2">Term</label>
                <select value={term} onChange={(e) => setTerm(e.target.value)}
                  className="w-full bg-surface-3 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[14px] text-ink-0 outline-none focus:border-gold-400">
                  {TERM_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="flex-1 min-w-[90px]">
                <label className="block font-mono text-meta text-ink-3 mb-s-2">Year</label>
                <select value={year} onChange={(e) => setYear(Number(e.target.value))}
                  className="w-full bg-surface-3 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[14px] text-ink-0 outline-none focus:border-gold-400">
                  {[CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-[140px]">
                <label className="block font-mono text-meta text-ink-3 mb-s-2">Due date (optional)</label>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                  className="w-full bg-surface-3 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[14px] text-ink-0 outline-none focus:border-gold-400"/>
              </div>
            </div>
          </Card>

          {/* Line items */}
          <Card className="bg-surface-2 border-line-2">
            <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-4">Line items (same for every pupil)</div>
            <div className="space-y-s-3">
              {items.map((item, i) => (
                <div key={i} className="grid grid-cols-[1fr_140px_32px] gap-s-2 items-center">
                  <input type="text" value={item.description}
                    onChange={(e) => updateItem(i, 'description', e.target.value)}
                    placeholder="Description"
                    className="bg-surface-3 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[14px] text-ink-0 outline-none focus:border-gold-400"/>
                  <input type="text" inputMode="decimal" value={item.amount}
                    onChange={(e) => updateItem(i, 'amount', e.target.value)}
                    placeholder="₦ Amount"
                    className="bg-surface-3 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[14px] text-ink-0 outline-none focus:border-gold-400 font-mono"/>
                  <button onClick={() => removeItem(i)} disabled={items.length === 1}
                    className="text-ink-3 hover:text-red-400 disabled:opacity-30">×</button>
                </div>
              ))}
              <button onClick={addItem} className="text-[13px] text-gold-400 hover:text-gold-200 font-mono">+ Add item</button>
            </div>
            {total > 0 && (
              <div className="mt-s-5 pt-s-4 border-t border-line-1 flex justify-between">
                <span className="font-mono text-meta text-ink-3">Per pupil total</span>
                <span className="font-display text-[20px] text-ink-0">{billingService.fmtKobo(total)}</span>
              </div>
            )}
          </Card>

          {/* Preview */}
          {classId && total > 0 && pupilCount > 0 && (
            <div className="p-s-5 bg-gold-400/[0.04] border border-gold-400/25 rounded-r-2">
              <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-2">Preview</div>
              <p className="text-body text-ink-2">
                {pupilCount} invoice{pupilCount !== 1 ? 's' : ''} ×{' '}
                {billingService.fmtKobo(total)} ={' '}
                <strong className="text-ink-0">{billingService.fmtKobo(total * pupilCount)}</strong> expected
              </p>
              <p className="mt-s-2 font-mono text-meta text-ink-3">
                Invoices start as drafts. Issue them individually or in bulk after review.
              </p>
            </div>
          )}

          {error && <div className="text-[13px] text-red-400 bg-red-400/10 border border-red-400/25 rounded-r-2 px-s-4 py-s-3">{error}</div>}

          <div className="flex gap-s-4">
            <Button
              intent="primary" size="md"
              onClick={() => { setError(null); bulkMut.mutate(); }}
              isLoading={bulkMut.isPending}
              disabled={!classId || total === 0 || pupilCount === 0}
            >
              Generate {pupilCount > 0 ? `${pupilCount} ` : ''}invoice{pupilCount !== 1 ? 's' : ''}
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
