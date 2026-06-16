/**
 * src/services/billingService.js
 *
 * School-side tuition billing. Completely separate from TTA platform
 * subscriptions (src/services/paymentService.js and tiersService.js).
 *
 * WHAT THIS COVERS
 * ─────────────────
 * - Creating and editing invoices for parents (school fees, levies, etc.)
 * - Recording cash / transfer / POS payments at the gate
 * - Querying outstanding balances by class or term
 * - The parent-facing invoice view
 *
 * WHAT IT DOES NOT COVER
 * ───────────────────────
 * - TTA platform subscriptions (handled by parentSubscriptionService)
 * - TTA school tier payments (handled by the admin billing view in AdminApp)
 *
 * MONEY RULES
 * ────────────
 * - ALL amounts are stored and calculated in kobo (minor units).
 * - Never store or pass floats. Use Math.round(naira * 100) → kobo.
 * - The helpers fmtKobo / koboFromNaira live here; UI imports them from here.
 */

import { supabase } from '@/lib/supabase';
import { logAuditEvent } from './auditService';

// ── Formatting helpers — used by components ───────────────────────────────────

/**
 * Format kobo as "₦12,240" (NGN) or "$18.78" (USD).
 * Safe to call with null/undefined — returns "₦0".
 */
export function fmtKobo(kobo, currency = 'NGN') {
  const major = Math.round(kobo ?? 0) / 100;
  if (currency === 'NGN') return `₦${major.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
  return `$${major.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Convert naira string/number entered by admin → kobo integer. */
export function koboFromNaira(naira) {
  const n = parseFloat(String(naira).replace(/,/g, ''));
  if (Number.isNaN(n) || n < 0) throw new Error('Invalid amount');
  return Math.round(n * 100);
}

/** Format a term code as readable label. */
export function fmtTerm(term) {
  return { term_1: 'First Term', term_2: 'Second Term', term_3: 'Third Term' }[term] ?? term;
}

// ── Admin: reading ────────────────────────────────────────────────────────────

/**
 * Term-level billing summary for the admin dashboard KPIs.
 * Returns { total_invoices, expected_kobo, collected_kobo, outstanding_kobo,
 *           overdue_count, paid_count, partial_count, collection_rate_pct }
 */
export async function getBillingSummary({ schoolId, term, year }) {
  const { data, error } = await supabase.rpc('school_billing_summary', {
    p_school_id: schoolId,
    p_term:      term,
    p_year:      year,
  });
  if (error) throw new Error(`Could not load billing summary: ${error.message}`);
  return data ?? {};
}

/**
 * Per-pupil outstanding balance for a class.
 * Returns [{ pupil_id, pupil_name, invoice_id, total_kobo, paid_kobo,
 *             outstanding, status, due_date }]
 */
export async function getClassOutstanding({ classId, term, year }) {
  const { data, error } = await supabase.rpc('get_class_outstanding', {
    p_class_id: classId,
    p_term:     term,
    p_year:     year,
  });
  if (error) throw new Error(`Could not load class balances: ${error.message}`);
  return data ?? [];
}

/**
 * List all invoices for a school in a term, with pupil name and class.
 * Used by the billing dashboard table.
 */
export async function listTermInvoices({ schoolId, term, year }) {
  const { data, error } = await supabase
    .from('school_invoices')
    .select(`
      id, pupil_id, class_id, term, academic_year,
      total_kobo, paid_kobo, status, due_date, issued_at,
      pupils(full_name, pupil_code),
      classes(name)
    `)
    .eq('school_id', schoolId)
    .eq('term', term)
    .eq('academic_year', year)
    .order('status')
    .order('pupils(full_name)');

  if (error) throw new Error(`Could not list invoices: ${error.message}`);
  return (data ?? []).map(normaliseInvoiceRow);
}

/** Full invoice detail including line items and payments. */
export async function getInvoiceDetail(invoiceId) {
  const { data: inv, error: invErr } = await supabase
    .from('school_invoices')
    .select(`
      *, pupils(full_name, pupil_code, level),
      classes(name),
      school_invoice_items(id, description, amount_kobo, sort_order),
      school_invoice_payments(id, amount_kobo, method, status, payment_date, notes, recorded_by)
    `)
    .eq('id', invoiceId)
    .single();

  if (invErr) throw new Error(`Could not load invoice: ${invErr.message}`);
  return inv;
}

// ── Admin: writing ────────────────────────────────────────────────────────────

/**
 * Create a single invoice for a pupil with line items.
 *
 * @param {object} params
 *   - schoolId, pupilId, classId (optional), term, year, dueDate (optional)
 *   - items: [{ description, amountKobo }]
 *   - notes (optional)
 */
export async function createInvoice({ schoolId, pupilId, classId, term, year, dueDate, items, notes }) {
  if (!items?.length) throw new Error('At least one line item is required.');

  // Insert invoice (total_kobo is computed by trigger after items insert)
  const { data: invoice, error: invErr } = await supabase
    .from('school_invoices')
    .insert({
      school_id:    schoolId,
      pupil_id:     pupilId,
      class_id:     classId ?? null,
      term,
      academic_year: year,
      due_date:     dueDate ?? null,
      notes:        notes ?? null,
      status:       'draft',
    })
    .select()
    .single();

  if (invErr) {
    if (/unique/i.test(invErr.message)) {
      throw new Error(`An invoice already exists for this pupil in ${fmtTerm(term)} ${year}. Edit the existing invoice instead.`);
    }
    throw new Error(invErr.message);
  }

  // Insert line items (trigger recalculates total_kobo automatically)
  const rows = items.map((item, i) => ({
    invoice_id:  invoice.id,
    description: item.description.trim(),
    amount_kobo: item.amountKobo,
    sort_order:  i,
  }));

  const { error: itemErr } = await supabase
    .from('school_invoice_items')
    .insert(rows);

  if (itemErr) throw new Error(`Could not add line items: ${itemErr.message}`);

  logAuditEvent({
    action:  'billing.invoice_created',
    details: { invoice_id: invoice.id, pupil_id: pupilId, term, year, item_count: rows.length },
  });

  return invoice;
}

/**
 * Issue an invoice — flips status from 'draft' → 'issued' and stamps issued_at.
 * Only issued invoices are visible to parents.
 */
export async function issueInvoice(invoiceId) {
  const { data, error } = await supabase
    .from('school_invoices')
    .update({ status: 'issued', issued_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', invoiceId)
    .eq('status', 'draft')    // only draft invoices can be issued
    .select()
    .single();

  if (error) throw new Error(`Could not issue invoice: ${error.message}`);
  if (!data) throw new Error('Invoice not found or already issued.');

  logAuditEvent({ action: 'billing.invoice_issued', details: { invoice_id: invoiceId } });
  return data;
}

/**
 * Bulk-create invoices for an entire class.
 * Admin picks a class and a set of line items — one invoice per pupil is
 * created for every pupil in that class who doesn't already have one.
 *
 * Returns { created: number, skipped: number, errors: string[] }
 */
export async function bulkCreateClassInvoices({ schoolId, classId, term, year, dueDate, items }) {
  if (!items?.length) throw new Error('At least one line item is required.');

  // Fetch all pupils in the class
  const { data: pupils, error: pupilErr } = await supabase
    .from('pupils')
    .select('id, full_name')
    .eq('class_id', classId)
    .eq('school_id', schoolId);

  if (pupilErr) throw new Error(`Could not load pupils: ${pupilErr.message}`);
  if (!pupils?.length) throw new Error('No pupils found in this class.');

  let created = 0;
  let skipped = 0;
  const errors = [];

  for (const pupil of pupils) {
    try {
      await createInvoice({ schoolId, pupilId: pupil.id, classId, term, year, dueDate, items });
      created++;
    } catch (e) {
      if (e.message.includes('already exists')) {
        skipped++;
      } else {
        errors.push(`${pupil.full_name}: ${e.message}`);
      }
    }
  }

  logAuditEvent({
    action:  'billing.bulk_invoices_created',
    details: { school_id: schoolId, class_id: classId, term, year, created, skipped },
  });

  return { created, skipped, errors };
}

/**
 * Record a payment (cash / bank transfer / POS / other) against an invoice.
 *
 * @param {object} params
 *   - invoiceId, schoolId, amountKobo, method, paymentDate, notes (optional)
 */
export async function recordPayment({ invoiceId, schoolId, amountKobo, method = 'cash', paymentDate, notes }) {
  if (amountKobo <= 0) throw new Error('Payment amount must be positive.');

  const { data, error } = await supabase
    .from('school_invoice_payments')
    .insert({
      invoice_id:   invoiceId,
      school_id:    schoolId,
      amount_kobo:  amountKobo,
      method,
      payment_date: paymentDate ?? new Date().toISOString().slice(0, 10),
      notes:        notes ?? null,
      status:       'confirmed',
    })
    .select()
    .single();

  if (error) throw new Error(`Could not record payment: ${error.message}`);

  // Trigger on school_invoice_payments automatically updates paid_kobo + status
  // on the parent invoice — no manual update needed here.

  logAuditEvent({
    action:  'billing.payment_recorded',
    details: { invoice_id: invoiceId, amount_kobo: amountKobo, method },
  });

  return data;
}

/**
 * Reverse a payment (refund / correction).
 * Flips status to 'reversed'; the trigger recalculates paid_kobo.
 */
export async function reversePayment(paymentId) {
  const { data, error } = await supabase
    .from('school_invoice_payments')
    .update({ status: 'reversed', updated_at: new Date().toISOString() })
    .eq('id', paymentId)
    .select()
    .single();

  if (error) throw new Error(`Could not reverse payment: ${error.message}`);
  logAuditEvent({ action: 'billing.payment_reversed', details: { payment_id: paymentId } });
  return data;
}

// ── Parent-facing ─────────────────────────────────────────────────────────────

/**
 * Get all invoices for a pupil (parent view).
 * Returns the issued + partial + overdue + paid invoices in reverse term order.
 * Draft invoices are excluded — parents only see issued ones.
 */
export async function getMyChildInvoices(pupilId) {
  const { data, error } = await supabase
    .from('school_invoices')
    .select(`
      id, term, academic_year, total_kobo, paid_kobo,
      status, due_date, issued_at, notes,
      school_invoice_items(id, description, amount_kobo, sort_order)
    `)
    .eq('pupil_id', pupilId)
    .neq('status', 'draft')
    .neq('status', 'cancelled')
    .order('academic_year', { ascending: false })
    .order('term', { ascending: false });

  if (error) throw new Error(`Could not load invoices: ${error.message}`);
  return data ?? [];
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function normaliseInvoiceRow(row) {
  return {
    ...row,
    pupilName:  row.pupils?.full_name ?? '—',
    pupilCode:  row.pupils?.pupil_code ?? '',
    className:  row.classes?.name ?? '—',
    outstanding: Math.max(0, (row.total_kobo ?? 0) - (row.paid_kobo ?? 0)),
  };
}
