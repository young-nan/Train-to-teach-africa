/**
 * src/modules/admin/AuditLogView.jsx
 *
 * /app/admin/audit   (school_admin, head_teacher)
 * /app/super/audit   (super_admin — sees all schools)
 *
 * Every important data action in TTA is written to audit_log.
 * This view surfaces that trail for transparency and compliance.
 *
 * PRIVACY & COMPLIANCE
 * ─────────────────────
 * Audit logs are read-only. No deletion. This is intentional —
 * an audit trail that can be deleted defeats its own purpose.
 * School admins see only their school's entries (enforced by RLS).
 * Super admins see everything (scoped by filters).
 *
 * COLUMN MAP
 * ──────────
 * occurred_at      timestamptz
 * actor            text (user_id UUID or system identifier)
 * action           text ('attendance.marked', 'consent.granted', ...)
 * target_school_id uuid
 * target_user_id   uuid
 * details          jsonb
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { cn } from '@/utils/cn';

// ── Action category metadata ───────────────────────────────────────────────────

const ACTION_META = {
  // Attendance
  'attendance.marked':         { label: 'Attendance marked',     color: 'green'  },
  // Term locks
  'term.locked':               { label: 'Term locked',           color: 'amber'  },
  'term.unlocked':             { label: 'Term unlocked',         color: 'amber'  },
  // Reports
  'report.submitted':          { label: 'Report submitted',      color: 'default' },
  'report.approved':           { label: 'Report approved',       color: 'green'  },
  'report.published':          { label: 'Report published',      color: 'green'  },
  // School
  'school.created':            { label: 'School created',        color: 'gold'   },
  'school.deactivated':        { label: 'School deactivated',    color: 'red'    },
  // Connections
  'connection.approved':       { label: 'Connection approved',   color: 'green'  },
  'connection.revoked':        { label: 'Connection revoked',    color: 'red'    },
  // Subscriptions
  'subscription.activated':    { label: 'Subscription activated',color: 'green'  },
  'subscription.cancelled':    { label: 'Subscription cancelled',color: 'amber'  },
  // Consent
  'consent.operational_processing.granted': { label: 'Consent granted', color: 'green' },
  'consent.anonymized_research.granted':    { label: 'Research consent granted', color: 'gold' },
  'consent.anonymized_research.revoked':    { label: 'Research consent revoked', color: 'amber' },
  // Tutor
  'tutor.approved':            { label: 'Tutor approved',        color: 'green'  },
  'tutor.rejected':            { label: 'Tutor rejected',        color: 'red'    },
  // Impact
  'impact.csv_exported':       { label: 'Impact CSV exported',   color: 'default' },
  'impact.pdf_exported':       { label: 'Impact PDF exported',   color: 'default' },
};

function actionMeta(action) {
  if (ACTION_META[action]) return ACTION_META[action];
  // Fuzzy match on prefix
  const prefix = Object.keys(ACTION_META).find((k) => action?.startsWith(k.split('.')[0]));
  if (prefix) return { ...ACTION_META[prefix], label: action };
  return { label: action ?? '—', color: 'default' };
}

// ── Root ──────────────────────────────────────────────────────────────────────

export function AuditLogView() {
  const { schoolId, role } = useAuth();
  const isSuperAdmin = role === 'super_admin';

  const today    = new Date().toISOString().slice(0, 10);
  const weekAgo  = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);

  const [fromDate,    setFromDate]    = useState(weekAgo);
  const [toDate,      setToDate]      = useState(today);
  const [actionFilter, setActionFilter] = useState('');
  const [page,        setPage]        = useState(0);
  const PAGE_SIZE = 50;

  const { data, isLoading } = useQuery({
    queryKey: ['audit-log', schoolId, fromDate, toDate, actionFilter, page, isSuperAdmin],
    queryFn: async () => {
      let q = supabase
        .from('audit_log')
        .select('id, occurred_at, actor, action, target_user_id, target_school_id, details', { count: 'exact' })
        .gte('occurred_at', fromDate + 'T00:00:00Z')
        .lte('occurred_at', toDate   + 'T23:59:59Z')
        .order('occurred_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (!isSuperAdmin && schoolId) {
        q = q.eq('target_school_id', schoolId);
      }
      if (actionFilter) {
        q = q.ilike('action', `%${actionFilter}%`);
      }

      const { data, error, count } = await q;
      if (error) throw new Error(`Could not load audit log: ${error.message}`);
      return { rows: data ?? [], total: count ?? 0 };
    },
    staleTime: 30_000,
  });

  const rows  = data?.rows  ?? [];
  const total = data?.total ?? 0;
  const pages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="max-w-[960px]">
      <div className="mb-s-6">
        <div className="font-mono text-eyebrow uppercase text-gold-400">Audit log</div>
        <h2 className="mt-s-2 font-display text-display-2 text-ink-0">
          Data activity trail.
        </h2>
        <p className="mt-s-2 text-body text-ink-2 max-w-[58ch]">
          Every important data action is logged here for transparency and compliance.
          Logs are read-only and cannot be deleted.
          {isSuperAdmin && ' Showing all schools.'}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-s-4 items-end mb-s-5">
        <label className="flex flex-col gap-s-1">
          <span className="font-mono text-meta uppercase tracking-[0.12em] text-ink-3">From</span>
          <input type="date" value={fromDate} max={today}
            onChange={(e) => { setFromDate(e.target.value); setPage(0); }}
            className="bg-surface-2 border border-line-2 rounded-r-2 px-s-3 py-s-2 text-[13px] text-ink-0 outline-none focus:border-gold-400"
          />
        </label>
        <label className="flex flex-col gap-s-1">
          <span className="font-mono text-meta uppercase tracking-[0.12em] text-ink-3">To</span>
          <input type="date" value={toDate} max={today}
            onChange={(e) => { setToDate(e.target.value); setPage(0); }}
            className="bg-surface-2 border border-line-2 rounded-r-2 px-s-3 py-s-2 text-[13px] text-ink-0 outline-none focus:border-gold-400"
          />
        </label>
        <label className="flex flex-col gap-s-1 flex-1 min-w-[160px]">
          <span className="font-mono text-meta uppercase tracking-[0.12em] text-ink-3">Filter by action</span>
          <input type="text" value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(0); }}
            placeholder="e.g. attendance, consent, term"
            className="bg-surface-2 border border-line-2 rounded-r-2 px-s-3 py-s-2 text-[13px] text-ink-0 outline-none focus:border-gold-400"
          />
        </label>
        <div className="font-mono text-meta text-ink-3 pb-[2px]">
          {total.toLocaleString()} event{total !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Table */}
      {isLoading && (
        <div className="space-y-s-2">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="h-[52px] bg-surface-2 border border-line-1 rounded-r-2 animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && rows.length === 0 && (
        <Card className="bg-surface-2 text-center py-s-8">
          <p className="text-ink-3">No audit events in this date range.</p>
        </Card>
      )}

      {!isLoading && rows.length > 0 && (
        <>
          <div className="bg-surface-2 border border-line-1 rounded-r-3 overflow-hidden">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-line-2">
                  {['Time', 'Action', 'Actor', 'Details'].map((h) => (
                    <th key={h} className="text-left px-s-4 py-s-3 font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const meta = actionMeta(row.action);
                  return (
                    <tr key={row.id} className="border-b border-line-1 last:border-0 hover:bg-surface-3/40">
                      {/* Time */}
                      <td className="px-s-4 py-s-3 font-mono text-[11px] text-ink-4 whitespace-nowrap">
                        {new Date(row.occurred_at).toLocaleString('en-NG', {
                          day: 'numeric', month: 'short',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </td>
                      {/* Action */}
                      <td className="px-s-4 py-s-3">
                        <Chip variant={meta.color} size="sm">{meta.label}</Chip>
                      </td>
                      {/* Actor */}
                      <td className="px-s-4 py-s-3 font-mono text-[11px] text-ink-3 max-w-[120px] truncate">
                        {row.actor === row.target_user_id
                          ? 'self'
                          : row.actor?.slice(0, 8) ?? 'system'}
                      </td>
                      {/* Details */}
                      <td className="px-s-4 py-s-3 text-ink-3 max-w-[260px]">
                        <AuditDetails details={row.details} action={row.action} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-between mt-s-4">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="font-mono text-meta text-gold-400 disabled:text-ink-4 disabled:cursor-not-allowed"
              >
                ← Previous
              </button>
              <span className="font-mono text-meta text-ink-3">
                Page {page + 1} of {pages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
                disabled={page >= pages - 1}
                className="font-mono text-meta text-gold-400 disabled:text-ink-4 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Audit detail renderer ──────────────────────────────────────────────────────

function AuditDetails({ details, action }) {
  const [expanded, setExpanded] = useState(false);
  if (!details) return <span className="text-ink-4">—</span>;

  // Render a concise summary for known action types
  if (action?.startsWith('consent.')) {
    return (
      <span className="text-ink-2">
        {details.consent_type?.replace(/_/g, ' ')} — v{details.version}
      </span>
    );
  }
  if (action === 'term.locked' || action === 'term.unlocked') {
    return (
      <span className="text-ink-2">
        {details.term?.replace('_', ' ')} {details.year}
        {details.reason && ` · ${details.reason}`}
      </span>
    );
  }
  if (action === 'school.created') {
    return <span className="text-ink-2">{details.name}</span>;
  }
  if (action?.startsWith('impact.')) {
    return <span className="text-ink-2">{details.school_name ?? '—'}</span>;
  }

  // Generic JSON display with expand
  const str = JSON.stringify(details);
  if (str.length <= 60) {
    return <span className="font-mono text-[10.5px] text-ink-4">{str}</span>;
  }

  return (
    <span>
      {expanded
        ? <span className="font-mono text-[10.5px] text-ink-4 break-all">{str}</span>
        : <span className="font-mono text-[10.5px] text-ink-4">{str.slice(0, 60)}…</span>
      }
      <button
        onClick={() => setExpanded((v) => !v)}
        className="ml-s-1 text-gold-400 hover:text-gold-200 font-mono text-[10.5px]"
      >
        {expanded ? 'less' : 'more'}
      </button>
    </span>
  );
}
