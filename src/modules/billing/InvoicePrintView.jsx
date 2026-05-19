/**
 * src/modules/billing/InvoicePrintView.jsx
 *
 * /app/admin/billing/invoice/:invoiceId/print
 *
 * A clean print-optimised layout for a school invoice.
 * Automatically triggers window.print() on load (same pattern as
 * LessonPrintView and ReportCardPrint).
 *
 * Print CSS hides the browser chrome. The rendered page looks like
 * a proper A4 invoice with:
 *   - School logo + name (header)
 *   - Invoice metadata (number, date, due date, status)
 *   - Pupil details
 *   - Line item table
 *   - Payment history
 *   - Outstanding balance
 *   - Footer with TTA branding
 */

import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

const STATUS_LABEL = {
  draft:     'DRAFT',
  issued:    'ISSUED',
  partial:   'PARTIALLY PAID',
  paid:      'PAID IN FULL',
  overdue:   'OVERDUE',
  cancelled: 'CANCELLED',
};

function formatKobo(kobo) {
  return '₦' + (kobo / 100).toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function InvoicePrintView() {
  const { invoiceId } = useParams();
  const { schoolId }  = useAuth();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['invoice-print', invoiceId],
    queryFn: async () => {
      // Fetch invoice + items + payments + school + pupil in one go
      const { data: inv, error } = await supabase
        .from('school_invoices')
        .select(`
          *,
          pupils(full_name, pupil_code, level),
          school_invoice_items(id, description, amount_kobo, sort_order),
          school_invoice_payments(id, amount_kobo, method, status, payment_date, notes)
        `)
        .eq('id', invoiceId)
        .single();
      if (error) throw new Error(error.message);

      const { data: school } = await supabase
        .from('schools')
        .select('name, logo_url, city, state, phone')
        .eq('id', schoolId)
        .single();

      return { invoice: inv, school };
    },
    enabled: !!invoiceId && !!schoolId,
    staleTime: Infinity,
  });

  // Auto-print after data loads
  useEffect(() => {
    if (!data) return;
    const t = setTimeout(() => window.print(), 500);
    return () => clearTimeout(t);
  }, [data]);

  if (isLoading) return <div style={{ padding: 40, fontFamily: 'monospace' }}>Loading invoice…</div>;
  if (isError || !data) return <div style={{ padding: 40, fontFamily: 'monospace' }}>Invoice not found.</div>;

  const { invoice, school } = data;
  const items    = (invoice.school_invoice_items    ?? []).sort((a, b) => a.sort_order - b.sort_order);
  const payments = (invoice.school_invoice_payments ?? []).filter((p) => p.status === 'confirmed');
  const pupil    = invoice.pupils;

  const outstanding = invoice.total_kobo - invoice.paid_kobo;
  const statusLabel = STATUS_LABEL[invoice.status] ?? invoice.status?.toUpperCase();

  const termLabel = invoice.term?.replace('_', ' ')?.replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1a1a1a; background: #fff; }
        .page { max-width: 794px; margin: 0 auto; padding: 48px 56px; min-height: 1123px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1a1a1a; padding-bottom: 24px; margin-bottom: 32px; }
        .school-name { font-size: 22px; font-weight: 700; letter-spacing: -0.3px; }
        .school-meta { font-size: 11px; color: #555; margin-top: 4px; line-height: 1.6; }
        .logo { width: 72px; height: 72px; object-fit: contain; }
        .invoice-title { font-size: 32px; font-weight: 700; text-align: right; letter-spacing: -0.5px; }
        .status-badge { display: inline-block; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; padding: 3px 10px; border-radius: 3px; margin-top: 6px; }
        .status-paid     { background: #d1fae5; color: #065f46; }
        .status-overdue  { background: #fee2e2; color: #991b1b; }
        .status-partial  { background: #fef3c7; color: #92400e; }
        .status-default  { background: #f3f4f6; color: #374151; }
        .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px 48px; margin-bottom: 32px; }
        .meta-label { font-size: 10px; font-weight: 700; letter-spacing: 0.12em; color: #666; text-transform: uppercase; margin-bottom: 2px; }
        .meta-value { font-size: 13px; color: #111; }
        .table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        .table th { font-size: 10px; font-weight: 700; letter-spacing: 0.12em; color: #444; text-transform: uppercase; border-bottom: 1px solid #ddd; padding: 8px 0; text-align: left; }
        .table th:last-child, .table td:last-child { text-align: right; }
        .table td { padding: 10px 0; border-bottom: 1px solid #eee; font-size: 13px; vertical-align: top; }
        .totals { margin-left: auto; width: 280px; }
        .totals-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; }
        .totals-row.total { font-weight: 700; font-size: 15px; border-top: 2px solid #111; margin-top: 4px; padding-top: 8px; }
        .totals-row.outstanding { color: ${outstanding > 0 ? '#b91c1c' : '#065f46'}; font-weight: 700; }
        .payments-section { margin-top: 32px; }
        .section-title { font-size: 11px; font-weight: 700; letter-spacing: 0.12em; color: #444; text-transform: uppercase; margin-bottom: 10px; }
        .footer { margin-top: 56px; padding-top: 16px; border-top: 1px solid #ddd; display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #888; }
        @media print {
          @page { margin: 0; size: A4; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none; }
        }
      `}</style>

      {/* Print button — hidden when printing */}
      <div className="no-print" style={{ background: '#f3f4f6', padding: '12px 24px', display: 'flex', gap: 12, alignItems: 'center' }}>
        <button
          onClick={() => window.print()}
          style={{ background: '#1a1305', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
        >
          Print / Save PDF
        </button>
        <button
          onClick={() => window.close()}
          style={{ background: 'none', border: '1px solid #ccc', padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
        >
          Close
        </button>
      </div>

      <div className="page">
        {/* Header */}
        <div className="header">
          <div>
            {school?.logo_url && (
              <img src={school.logo_url} alt="School logo" className="logo" style={{ marginBottom: 8 }} />
            )}
            <div className="school-name">{school?.name}</div>
            <div className="school-meta">
              {[school?.city, school?.state].filter(Boolean).join(', ')}<br />
              {school?.phone}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="invoice-title">INVOICE</div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
              #{invoiceId.slice(0, 8).toUpperCase()}
            </div>
            <div className={`status-badge ${
              invoice.status === 'paid'    ? 'status-paid'
              : invoice.status === 'overdue' ? 'status-overdue'
              : invoice.status === 'partial' ? 'status-partial'
              : 'status-default'
            }`}>
              {statusLabel}
            </div>
          </div>
        </div>

        {/* Meta grid */}
        <div className="meta-grid">
          <div>
            <div className="meta-label">Billed to</div>
            <div className="meta-value" style={{ fontWeight: 600 }}>{pupil?.full_name}</div>
            <div className="meta-value" style={{ color: '#555', fontSize: 12 }}>
              {pupil?.pupil_code && `Code: ${pupil.pupil_code}`}
            </div>
          </div>
          <div>
            <div className="meta-label">Term</div>
            <div className="meta-value">{termLabel} · {invoice.academic_year}</div>
          </div>
          <div>
            <div className="meta-label">Issue date</div>
            <div className="meta-value">
              {invoice.issued_at
                ? new Date(invoice.issued_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })
                : new Date(invoice.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </div>
          {invoice.due_date && (
            <div>
              <div className="meta-label">Due date</div>
              <div className="meta-value" style={{ color: invoice.status === 'overdue' ? '#b91c1c' : 'inherit' }}>
                {new Date(invoice.due_date + 'T00:00:00').toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>
          )}
        </div>

        {/* Line items */}
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: '60%' }}>Description</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.description}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {formatKobo(item.amount_kobo)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="totals">
          <div className="totals-row total">
            <span>Total</span>
            <span>{formatKobo(invoice.total_kobo)}</span>
          </div>
          <div className="totals-row">
            <span>Amount paid</span>
            <span style={{ color: '#065f46' }}>− {formatKobo(invoice.paid_kobo)}</span>
          </div>
          <div className="totals-row outstanding">
            <span>Balance due</span>
            <span>{formatKobo(Math.max(0, outstanding))}</span>
          </div>
        </div>

        {/* Payment history */}
        {payments.length > 0 && (
          <div className="payments-section">
            <div className="section-title">Payment history</div>
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Method</th>
                  <th>Notes</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td>{new Date(p.payment_date + 'T00:00:00').toLocaleDateString('en-NG')}</td>
                    <td style={{ textTransform: 'capitalize' }}>{p.method?.replace('_', ' ')}</td>
                    <td style={{ color: '#666' }}>{p.notes ?? '—'}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {formatKobo(p.amount_kobo)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Notes */}
        {invoice.notes && (
          <div style={{ marginTop: 24, background: '#f9fafb', padding: '12px 16px', borderRadius: 4, fontSize: 12, color: '#555' }}>
            <strong>Notes:</strong> {invoice.notes}
          </div>
        )}

        {/* Footer */}
        <div className="footer">
          <div>Powered by Train To Teach Africa · traintoteachafrica.org</div>
          <div>Printed {new Date().toLocaleDateString('en-NG')}</div>
        </div>
      </div>
    </>
  );
}
