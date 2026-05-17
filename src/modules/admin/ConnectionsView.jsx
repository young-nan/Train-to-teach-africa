/**
 * src/modules/admin/ConnectionsView.jsx
 *
 * /app/admin/connections
 *
 * School admin reviews parent connection requests.
 * Three tabs: Pending (action needed), Approved, Rejected/Revoked.
 *
 * WORKFLOW REMINDER
 * ─────────────────
 * 1. Parent submits request via ChildEnrolmentView → SchoolConnectionCard
 *    → parent_school_connections row (status: 'pending')
 * 2. School admin reviews here → picks the actual pupil from their roster
 *    → configures which data types to share
 *    → approves → parent_pupil_links row created
 * 3. Parent immediately sees school-connected data per share settings
 *
 * PRIVACY RULE
 * ────────────
 * This view shows the parent's name, email, and their claimed child name.
 * It NEVER shows other pupils' data to the reviewing admin beyond what
 * is needed to identify the correct pupil.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import * as schoolConnectionService from '@/services/schoolConnectionService';
import { supabase } from '@/lib/supabase';
import { friendlyError } from '@/utils/friendlyError';

export function ConnectionsView() {
  const { schoolId } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState('pending');

  const { data: connections, isLoading } = useQuery({
    queryKey:  ['admin', 'connections', schoolId, tab],
    queryFn:   () => schoolConnectionService.listSchoolConnections({
      status: tab === 'all' ? null : tab,
    }),
    enabled:   !!schoolId,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const pendingCount = useQuery({
    queryKey:  ['admin', 'connections', schoolId, 'pending'],
    queryFn:   () => schoolConnectionService.listPendingConnections(),
    enabled:   !!schoolId,
    staleTime: 30_000,
    select:    (d) => d.length,
  });

  const TABS = [
    { value: 'pending',  label: 'Pending',  badge: pendingCount.data ?? 0 },
    { value: 'approved', label: 'Approved'  },
    { value: 'rejected', label: 'Declined'  },
    { value: 'revoked',  label: 'Revoked'   },
  ];

  return (
    <div className="max-w-[860px]">
      <div className="mb-s-7">
        <div className="font-mono text-eyebrow uppercase text-gold-400">
          Parent connections
        </div>
        <h2 className="mt-s-3 font-display text-display-2 text-ink-0">
          Parent connection requests.
        </h2>
        <p className="mt-s-3 text-body text-ink-2 max-w-[60ch]">
          Parents request connections to share their child's school progress.
          You decide which data types to share on approval.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-s-1 mb-s-6 border-b border-line-2">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={[
              'px-s-4 py-s-3 font-mono text-meta border-b-2 -mb-px transition-colors flex items-center gap-s-2',
              tab === t.value
                ? 'border-gold-400 text-gold-400'
                : 'border-transparent text-ink-3 hover:text-ink-1',
            ].join(' ')}
          >
            {t.label}
            {t.badge > 0 && (
              <span className="bg-amber-400 text-[#1a1305] rounded-full text-[10px] font-bold px-[6px] py-[1px]">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading && (
        <div className="space-y-s-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-surface-2 border border-line-2 rounded-r-3 animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && (connections ?? []).length === 0 && (
        <Card className="bg-surface-2 border-line-2">
          <p className="text-body text-ink-2">
            {tab === 'pending'
              ? 'No pending connection requests.'
              : `No ${tab} connections.`}
          </p>
        </Card>
      )}

      <div className="space-y-s-4">
        {(connections ?? []).map((conn) => (
          tab === 'pending'
            ? <PendingConnectionCard
                key={conn.id}
                connection={conn}
                schoolId={schoolId}
                onAction={() => qc.invalidateQueries({ queryKey: ['admin', 'connections', schoolId] })}
              />
            : <ConnectionSummaryCard
                key={conn.id}
                connection={conn}
                onUpdate={() => qc.invalidateQueries({ queryKey: ['admin', 'connections', schoolId] })}
              />
        ))}
      </div>
    </div>
  );
}

// ── Pending connection card ───────────────────────────────────────────────────

function PendingConnectionCard({ connection, schoolId, onAction }) {
  const [reviewing, setReviewing] = useState(false);

  if (reviewing) {
    return (
      <ApprovalForm
        connection={connection}
        schoolId={schoolId}
        onDone={() => { setReviewing(false); onAction(); }}
        onCancel={() => setReviewing(false)}
      />
    );
  }

  return (
    <Card className="bg-surface-2 border-amber-400/20">
      <div className="flex items-start justify-between gap-s-4">
        <div className="flex-1 min-w-0">
          {/* Parent info */}
          <div className="font-display text-[16px] text-ink-0">
            {connection.profiles?.full_name ?? 'Parent'}
          </div>
          <div className="font-mono text-meta text-ink-3 mt-s-1">
            {connection.profiles?.email}
          </div>

          {/* Request details */}
          <div className="mt-s-3 bg-surface-3 border border-line-2 rounded-r-2 px-s-4 py-s-3">
            <div className="font-mono text-meta uppercase text-ink-3 mb-s-2">
              Claims their child is:
            </div>
            <div className="text-body text-ink-0">
              {connection.claimed_child_name}
            </div>
            {connection.claimed_class_name && (
              <div className="font-mono text-meta text-ink-3 mt-s-1">
                Class: {connection.claimed_class_name}
              </div>
            )}
          </div>

          <div className="mt-s-2 font-mono text-meta text-ink-3">
            Requested {new Date(connection.requested_at).toLocaleDateString('en-NG', {
              day: 'numeric', month: 'short', year: 'numeric',
            })}
          </div>
        </div>

        <div className="flex flex-col gap-s-2 shrink-0">
          <Button intent="primary" size="sm" onClick={() => setReviewing(true)}>
            Review →
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ── Approval form ─────────────────────────────────────────────────────────────

function ApprovalForm({ connection, schoolId, onDone, onCancel }) {
  const qc = useQueryClient();
  const [selectedPupilId, setSelectedPupilId] = useState('');
  const [shareConfig, setShareConfig] = useState({
    share_attendance:    false,
    share_term_reports:  false,
    share_score_summary: false,
  });
  const [rejectionReason, setRejectionReason] = useState('');
  const [mode, setMode] = useState('select');  // 'select' | 'approve' | 'reject'

  // Load pupils for this school (to let admin identify the right one)
  const { data: pupils } = useQuery({
    queryKey:  ['admin', 'pupils-list', schoolId],
    queryFn:   async () => {
      const { data } = await supabase
        .from('pupils')
        .select('id, full_name, level, classes(name)')
        .eq('school_id', schoolId)
        .order('full_name');
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });

  // Filter pupils to those that match the claimed name (fuzzy)
  const suggestedPupils = (pupils ?? []).filter((p) =>
    p.full_name.toLowerCase().includes(
      connection.claimed_child_name.toLowerCase().split(' ')[0]
    )
  );
  const otherPupils = (pupils ?? []).filter((p) => !suggestedPupils.includes(p));

  const approve = useMutation({
    mutationFn: () => {
      if (!selectedPupilId) throw new Error('Select the pupil this parent is linking to.');
      return schoolConnectionService.approveConnection({
        connectionId: connection.id,
        pupilId:      selectedPupilId,
        shareConfig,
      });
    },
    onSuccess: onDone,
  });

  const reject = useMutation({
    mutationFn: () => {
      if (!rejectionReason.trim()) throw new Error('A reason is required.');
      return schoolConnectionService.rejectConnection({
        connectionId: connection.id,
        reason:       rejectionReason.trim(),
      });
    },
    onSuccess: onDone,
  });

  const toggleShare = (key) => setShareConfig((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <Card className="bg-surface-2 border-gold-400/20">
      <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-4">
        Review: {connection.profiles?.full_name ?? 'Parent'} → {connection.claimed_child_name}
      </div>

      {/* Step 1: Select pupil */}
      <div className="mb-s-5">
        <div className="text-body text-ink-1 mb-s-3">
          Which pupil is <strong>{connection.claimed_child_name}</strong> in your records?
        </div>

        {suggestedPupils.length > 0 && (
          <div className="mb-s-3">
            <div className="font-mono text-meta text-ink-3 mb-s-2">Best matches</div>
            <div className="space-y-s-2">
              {suggestedPupils.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPupilId(p.id)}
                  className={[
                    'w-full text-left px-s-4 py-s-3 rounded-r-2 border transition-colors',
                    selectedPupilId === p.id
                      ? 'border-gold-400 bg-gold-400/10 text-gold-200'
                      : 'border-line-2 bg-surface-3 text-ink-1 hover:border-line-1',
                  ].join(' ')}
                >
                  <span className="font-medium">{p.full_name}</span>
                  <span className="font-mono text-meta text-ink-3 ml-s-3">
                    {p.classes?.name ?? p.level}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {otherPupils.length > 0 && (
          <div>
            <div className="font-mono text-meta text-ink-3 mb-s-2">
              {suggestedPupils.length > 0 ? 'Other pupils' : 'All pupils'}
            </div>
            <select
              value={suggestedPupils.some((p) => p.id === selectedPupilId) ? '' : selectedPupilId}
              onChange={(e) => setSelectedPupilId(e.target.value)}
              className="w-full bg-surface-3 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-body text-ink-0 focus:border-gold-400 outline-none"
            >
              <option value="">Search all pupils…</option>
              {otherPupils.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name} — {p.classes?.name ?? p.level}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Step 2: Configure sharing (only if a pupil is selected) */}
      {selectedPupilId && (
        <div className="mb-s-5 bg-surface-3 border border-line-2 rounded-r-2 p-s-4">
          <div className="text-body text-ink-1 mb-s-3">
            What will this parent be able to see?
          </div>
          <div className="space-y-s-3">
            {[
              { key: 'share_attendance',    label: 'Weekly attendance summary',   desc: 'Absent/present/late counts per week. No teacher comments.' },
              { key: 'share_term_reports',  label: 'Published term report cards', desc: 'Only when the school admin publishes them. Not drafts.' },
              { key: 'share_score_summary', label: 'Subject score averages',      desc: 'Average performance per subject. Not individual assessment scores.' },
            ].map(({ key, label, desc }) => (
              <button
                key={key}
                onClick={() => toggleShare(key)}
                className="w-full text-left flex items-start gap-s-4"
              >
                <div className={[
                  'mt-[2px] w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                  shareConfig[key]
                    ? 'border-gold-400 bg-gold-400'
                    : 'border-line-2 bg-surface-3',
                ].join(' ')}>
                  {shareConfig[key] && <span className="text-[10px] text-[#1a1305] font-bold">✓</span>}
                </div>
                <div>
                  <div className="text-[13.5px] text-ink-1">{label}</div>
                  <div className="font-mono text-[11px] text-ink-3">{desc}</div>
                </div>
              </button>
            ))}
          </div>
          {!Object.values(shareConfig).some(Boolean) && (
            <p className="mt-s-3 font-mono text-[11px] text-amber-400">
              You can approve the connection without sharing any data yet.
              The parent can see TTA lesson content regardless.
            </p>
          )}
        </div>
      )}

      {/* Error display */}
      {(approve.error || reject.error) && (
        <div className="mb-s-4 text-[13px] text-red-400 bg-red-400/10 border border-red-400/30 rounded-r-2 px-s-4 py-s-3">
          {friendlyError(approve.error ?? reject.error)}
        </div>
      )}

      {/* Actions */}
      {mode === 'select' && (
        <div className="flex flex-wrap gap-s-3">
          <Button
            intent="primary"
            onClick={() => approve.mutate()}
            disabled={!selectedPupilId || approve.isPending}
          >
            {approve.isPending ? 'Approving…' : 'Approve connection'}
          </Button>
          <Button
            intent="ghost"
            onClick={() => setMode('reject')}
          >
            Decline request
          </Button>
          <Button intent="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      )}

      {/* Rejection form */}
      {mode === 'reject' && (
        <div className="space-y-s-4">
          <textarea
            rows={3}
            className="w-full bg-surface-3 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-body text-ink-0 outline-none focus:border-gold-400 resize-none"
            placeholder="Reason for declining (required — parent will see this)…"
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
          />
          <div className="flex gap-s-3">
            <Button
              intent="ghost"
              onClick={() => reject.mutate()}
              disabled={!rejectionReason.trim() || reject.isPending}
            >
              {reject.isPending ? 'Declining…' : 'Confirm decline'}
            </Button>
            <Button intent="ghost" onClick={() => setMode('select')}>
              Back
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

// ── Approved/revoked connection summary ───────────────────────────────────────

function ConnectionSummaryCard({ connection, onUpdate }) {
  const qc = useQueryClient();
  const [editingShare, setEditingShare] = useState(false);
  const [shareConfig, setShareConfig] = useState({
    share_attendance:    connection.share_attendance,
    share_term_reports:  connection.share_term_reports,
    share_score_summary: connection.share_score_summary,
  });

  const revoke = useMutation({
    mutationFn: () => schoolConnectionService.revokeConnection(connection.id),
    onSuccess: onUpdate,
  });

  const updateShare = useMutation({
    mutationFn: () => schoolConnectionService.updateShareSettings({
      connectionId: connection.id,
      shareConfig,
    }),
    onSuccess: () => { setEditingShare(false); onUpdate(); },
  });

  const statusColor = {
    approved: 'green',
    rejected: 'default',
    revoked:  'default',
  }[connection.status] ?? 'default';

  return (
    <Card className="bg-surface-2 border-line-2">
      <div className="flex items-start justify-between gap-s-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-s-3 mb-s-1">
            <div className="font-display text-[16px] text-ink-0">
              {connection.profiles?.full_name ?? 'Parent'}
            </div>
            <Chip variant={statusColor} dot size="sm">{connection.status}</Chip>
          </div>
          <div className="font-mono text-meta text-ink-3">
            {connection.profiles?.email} · for {connection.pupils?.full_name ?? connection.claimed_child_name}
          </div>

          {connection.status === 'approved' && !editingShare && (
            <div className="mt-s-3 flex flex-wrap gap-s-2">
              {connection.share_attendance    && <Chip variant="default" size="sm">Attendance</Chip>}
              {connection.share_term_reports  && <Chip variant="default" size="sm">Reports</Chip>}
              {connection.share_score_summary && <Chip variant="default" size="sm">Scores</Chip>}
              {!connection.share_attendance && !connection.share_term_reports && !connection.share_score_summary && (
                <span className="font-mono text-meta text-ink-3">No data shared</span>
              )}
            </div>
          )}

          {/* Inline share settings editor */}
          {editingShare && (
            <div className="mt-s-4 bg-surface-3 border border-line-2 rounded-r-2 p-s-4 space-y-s-3">
              {[
                { key: 'share_attendance',    label: 'Attendance summary' },
                { key: 'share_term_reports',  label: 'Term report cards' },
                { key: 'share_score_summary', label: 'Score averages' },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-s-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={shareConfig[key]}
                    onChange={() => setShareConfig((p) => ({ ...p, [key]: !p[key] }))}
                    className="w-4 h-4 rounded border-line-2"
                  />
                  <span className="text-body text-ink-1">{label}</span>
                </label>
              ))}
              <div className="flex gap-s-3 pt-s-2">
                <Button size="sm" intent="primary" onClick={() => updateShare.mutate()} disabled={updateShare.isPending}>
                  {updateShare.isPending ? 'Saving…' : 'Save settings'}
                </Button>
                <Button size="sm" intent="ghost" onClick={() => setEditingShare(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        {connection.status === 'approved' && (
          <div className="flex flex-col gap-s-2 shrink-0">
            <button
              onClick={() => setEditingShare((v) => !v)}
              className="font-mono text-meta text-ink-3 hover:text-gold-200 text-right"
            >
              Edit sharing
            </button>
            <button
              onClick={() => {
                if (window.confirm('Revoke this connection? The parent will lose access to school data.')) {
                  revoke.mutate();
                }
              }}
              className="font-mono text-meta text-red-400 hover:text-red-300 text-right"
              disabled={revoke.isPending}
            >
              {revoke.isPending ? 'Revoking…' : 'Revoke'}
            </button>
          </div>
        )}
      </div>

      {connection.rejection_reason && (
        <div className="mt-s-3 font-mono text-meta text-ink-3 italic">
          Reason: {connection.rejection_reason}
        </div>
      )}
    </Card>
  );
}
