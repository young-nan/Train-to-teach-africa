/**
 * src/modules/teacher/InterventionsView.jsx
 *
 * /app/teacher/interventions
 *
 * Teachers create and track support plans for pupils who are struggling.
 * Head teachers can see all interventions across the school (via the
 * school_id RLS policy) and can be escalated to.
 *
 * WORKFLOW
 * ────────
 * 1. Teacher notices a pupil is struggling (from at-risk alerts or observation)
 * 2. Creates an intervention: subject + concern + support plan + review date
 * 3. Intervention status: open → in_progress → resolved (or escalated)
 * 4. Notes can be added at any stage (append-only audit trail)
 * 5. Head teacher escalation: changes status to 'escalated', notifies head
 *
 * DATA
 * ────
 * - interventions table (migration 0010 Part 7)
 * - intervention_notes table (migration 0011 Part 7)
 * - get_class_interventions RPC (migration 0011 Part 8)
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import * as simsService from '@/services/simsService';
import { logAuditEvent } from '@/services/auditService';
import { friendlyError } from '@/utils/friendlyError';

const NAV = [
  { to: '/app/teacher',                  label: 'Dashboard',     end: true },
  { to: '/app/teacher/attendance',       label: 'Attendance'     },
  { to: '/app/teacher/gradebook',        label: 'Gradebook'      },
  { to: '/app/teacher/reports',          label: 'Reports'        },
  { to: '/app/teacher/interventions',    label: 'Interventions'  },
];

const STATUS_CONFIG = {
  open:        { label: 'Open',        variant: 'amber',   next: 'in_progress' },
  in_progress: { label: 'In progress', variant: 'gold',    next: 'resolved'    },
  escalated:   { label: 'Escalated',   variant: 'red',     next: null          },
  resolved:    { label: 'Resolved',    variant: 'green',   next: null          },
};

export function InterventionsView() {
  const { profile, schoolId } = useAuth();
  const qc = useQueryClient();
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [statusFilter,    setStatusFilter]    = useState('open');
  const [creating,        setCreating]        = useState(false);
  const [expandedId,      setExpandedId]      = useState(null);

  // Teacher's classes
  const { data: classes } = useQuery({
    queryKey:  ['teacher', 'classes', profile?.user_id],
    queryFn:   simsService.getMyClasses,
    staleTime: 5 * 60_000,
  });

  // Auto-select first class
  const activeClassId = selectedClassId ?? classes?.[0]?.id ?? null;

  // Interventions for selected class
  const { data: interventions, isLoading } = useQuery({
    queryKey:  ['interventions', activeClassId, statusFilter],
    queryFn:   async () => {
      const { data, error } = await supabase.rpc('get_class_interventions', {
        p_class_id: activeClassId,
        p_status:   statusFilter === 'all' ? null : statusFilter,
      });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled:   !!activeClassId,
    staleTime: 60_000,
  });

  const resolvedCount   = interventions?.filter((i) => i.status === 'resolved').length ?? 0;
  const openCount       = interventions?.filter((i) => i.status !== 'resolved').length ?? 0;

  return (
    <AppShell title="Interventions" navItems={NAV}>
      <div className="max-w-[860px]">
        {/* Header */}
        <div className="mb-s-7 flex items-end justify-between flex-wrap gap-s-4">
          <div>
            <div className="font-mono text-eyebrow uppercase text-gold-400">
              Interventions
            </div>
            <h2 className="mt-s-3 font-display text-display-2 text-ink-0">
              Support plans.
            </h2>
            <p className="mt-s-3 text-body text-ink-2 max-w-[58ch]">
              Track pupils who need extra support. Create a plan, add notes
              as the situation evolves, and escalate to your head teacher if needed.
            </p>
          </div>
          {activeClassId && (
            <Button intent="primary" size="md" onClick={() => setCreating(true)}>
              + New intervention
            </Button>
          )}
        </div>

        {/* Class selector */}
        {(classes?.length ?? 0) > 1 && (
          <div className="mb-s-5">
            <label className="font-mono text-eyebrow uppercase text-ink-3 block mb-s-2">
              Class
            </label>
            <select
              value={activeClassId ?? ''}
              onChange={(e) => setSelectedClassId(e.target.value || null)}
              className="bg-surface-2 border border-line-2 rounded-r-1 px-s-4 py-s-3 text-body text-ink-0 focus:border-gold-400 outline-none"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Create form */}
        {creating && activeClassId && (
          <CreateInterventionCard
            classId={activeClassId}
            schoolId={schoolId}
            pupils={[]} // fetched inside the component
            onDone={() => {
              setCreating(false);
              qc.invalidateQueries({ queryKey: ['interventions', activeClassId] });
            }}
          />
        )}

        {/* Status tabs */}
        <div className="flex gap-s-1 mb-s-6 border-b border-line-2">
          {[
            { value: 'open',        label: 'Open & In progress' },
            { value: 'escalated',   label: 'Escalated'         },
            { value: 'resolved',    label: 'Resolved'          },
            { value: 'all',         label: 'All'               },
          ].map((t) => (
            <button
              key={t.value}
              onClick={() => setStatusFilter(t.value)}
              className={[
                'px-s-4 py-s-3 font-mono text-meta border-b-2 -mb-px transition-colors',
                statusFilter === t.value
                  ? 'border-gold-400 text-gold-400'
                  : 'border-transparent text-ink-3 hover:text-ink-1',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Summary bar */}
        {(interventions?.length ?? 0) > 0 && (
          <div className="flex gap-s-4 mb-s-5 font-mono text-meta text-ink-3">
            <span>{openCount} open</span>
            <span>{resolvedCount} resolved</span>
          </div>
        )}

        {/* List */}
        {isLoading && (
          <div className="space-y-s-3">
            {[1,2,3].map((i) => (
              <div key={i} className="h-24 bg-surface-2 border border-line-2 rounded-r-3 animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && (interventions?.length ?? 0) === 0 && (
          <Card className="bg-surface-2 border-line-2">
            <p className="text-body text-ink-2">
              {statusFilter === 'all'
                ? 'No interventions yet for this class.'
                : `No ${statusFilter} interventions.`}
            </p>
          </Card>
        )}

        <div className="space-y-s-4">
          {interventions?.map((intervention) => (
            <InterventionCard
              key={intervention.intervention_id}
              intervention={intervention}
              isExpanded={expandedId === intervention.intervention_id}
              onToggle={() => setExpandedId(
                expandedId === intervention.intervention_id
                  ? null
                  : intervention.intervention_id
              )}
              onUpdate={() => qc.invalidateQueries({ queryKey: ['interventions', activeClassId] })}
            />
          ))}
        </div>
      </div>
    </AppShell>
  );
}

// ── Intervention card ─────────────────────────────────────────────────────────

function InterventionCard({ intervention, isExpanded, onToggle, onUpdate }) {
  const qc  = useQueryClient();
  const cfg = STATUS_CONFIG[intervention.status] ?? STATUS_CONFIG.open;

  const updateStatus = useMutation({
    mutationFn: async (newStatus) => {
      const { error } = await supabase
        .from('interventions')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', intervention.intervention_id);
      if (error) throw new Error(error.message);
      logAuditEvent({
        action:  'intervention.status_updated',
        details: { intervention_id: intervention.intervention_id, new_status: newStatus },
      });
    },
    onSuccess: onUpdate,
  });

  const escalate = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('interventions')
        .update({
          status:       'escalated',
          escalated_at: new Date().toISOString(),
          updated_at:   new Date().toISOString(),
        })
        .eq('id', intervention.intervention_id);
      if (error) throw new Error(error.message);
      logAuditEvent({
        action:  'intervention.escalated',
        details: { intervention_id: intervention.intervention_id },
      });
    },
    onSuccess: onUpdate,
  });

  return (
    <Card className={[
      'bg-surface-2 border transition-colors',
      intervention.status === 'escalated' ? 'border-red-400/30'
        : intervention.status === 'resolved' ? 'border-green-400/20 opacity-75'
        : 'border-line-2',
    ].join(' ')}>
      {/* Summary row */}
      <button
        className="w-full text-left"
        onClick={onToggle}
      >
        <div className="flex items-start justify-between gap-s-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-s-3 mb-s-1 flex-wrap">
              <span className="font-display text-[16px] text-ink-0">
                {intervention.pupil_name}
              </span>
              <Chip variant={cfg.variant} dot size="sm">{cfg.label}</Chip>
              {intervention.note_count > 0 && (
                <span className="font-mono text-meta text-ink-3">
                  {intervention.note_count} note{intervention.note_count !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="font-mono text-meta text-ink-3">
              {intervention.subject}
              {intervention.review_date && (
                <> · Review: {new Date(intervention.review_date).toLocaleDateString('en-NG', {
                  day: 'numeric', month: 'short',
                })}</>
              )}
              {intervention.created_by_name && (
                <> · by {intervention.created_by_name}</>
              )}
            </div>
            <p className="mt-s-2 text-[13.5px] text-ink-2 line-clamp-2">
              {intervention.concern}
            </p>
          </div>
          <span className="font-mono text-meta text-ink-3 shrink-0 mt-s-1">
            {isExpanded ? '▲' : '▼'}
          </span>
        </div>
      </button>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="mt-s-5 border-t border-line-2 pt-s-5 space-y-s-5">
          {/* Concern + Plan */}
          <div className="grid md:grid-cols-2 gap-s-5">
            <div>
              <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-2">
                Concern
              </div>
              <p className="text-body text-ink-1">{intervention.concern}</p>
            </div>
            <div>
              <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-2">
                Support plan
              </div>
              <p className="text-body text-ink-1">{intervention.support_plan}</p>
            </div>
          </div>

          {/* Notes thread */}
          <NotesThread interventionId={intervention.intervention_id} />

          {/* Actions */}
          <div className="flex flex-wrap gap-s-3">
            {cfg.next && (
              <Button
                intent="primary"
                size="sm"
                onClick={() => updateStatus.mutate(cfg.next)}
                disabled={updateStatus.isPending}
              >
                Mark as {STATUS_CONFIG[cfg.next]?.label ?? cfg.next}
              </Button>
            )}
            {intervention.status !== 'escalated' && intervention.status !== 'resolved' && (
              <Button
                intent="ghost"
                size="sm"
                onClick={() => escalate.mutate()}
                disabled={escalate.isPending}
              >
                Escalate to head teacher
              </Button>
            )}
            {intervention.status !== 'resolved' && (
              <Button
                intent="ghost"
                size="sm"
                onClick={() => updateStatus.mutate('resolved')}
                disabled={updateStatus.isPending}
              >
                Mark resolved
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

// ── Notes thread ──────────────────────────────────────────────────────────────

function NotesThread({ interventionId }) {
  const qc = useQueryClient();
  const [body, setBody] = useState('');

  const { data: notes } = useQuery({
    queryKey:  ['intervention-notes', interventionId],
    queryFn:   async () => {
      const { data, error } = await supabase
        .from('intervention_notes')
        .select('id, body, created_at, profiles(full_name)')
        .eq('intervention_id', interventionId)
        .order('created_at', { ascending: true });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    staleTime: 30_000,
  });

  const addNote = useMutation({
    mutationFn: async () => {
      if (!body.trim()) throw new Error('Note is empty.');
      const { error } = await supabase
        .from('intervention_notes')
        .insert({ intervention_id: interventionId, body: body.trim() });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setBody('');
      qc.invalidateQueries({ queryKey: ['intervention-notes', interventionId] });
    },
  });

  return (
    <div>
      <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-3">
        Notes
      </div>

      {(notes ?? []).length === 0 && (
        <p className="text-[13px] text-ink-3 mb-s-3 italic">No notes yet.</p>
      )}

      <div className="space-y-s-2 mb-s-4">
        {notes?.map((note) => (
          <div key={note.id}
            className="bg-surface-3 border border-line-2 rounded-r-2 px-s-4 py-s-3">
            <div className="flex items-center gap-s-3 mb-s-1">
              <span className="font-mono text-meta text-ink-0">
                {note.profiles?.full_name ?? 'Teacher'}
              </span>
              <span className="font-mono text-[11px] text-ink-3">
                {new Date(note.created_at).toLocaleDateString('en-NG', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })}
              </span>
            </div>
            <p className="text-[13.5px] text-ink-1">{note.body}</p>
          </div>
        ))}
      </div>

      {/* Add note */}
      <div className="flex gap-s-3">
        <textarea
          rows={2}
          className="flex-1 bg-surface-3 border border-line-2 rounded-r-2 px-s-3 py-s-2 text-[13.5px] text-ink-0 outline-none focus:border-gold-400 resize-none"
          placeholder="Add a progress note…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <Button
          intent="ghost"
          size="sm"
          onClick={() => addNote.mutate()}
          disabled={addNote.isPending || !body.trim()}
        >
          {addNote.isPending ? '…' : 'Add'}
        </Button>
      </div>
      {addNote.error && (
        <p className="mt-s-2 text-[12px] text-red-400">{friendlyError(addNote.error)}</p>
      )}
    </div>
  );
}

// ── Create intervention card ──────────────────────────────────────────────────

function CreateInterventionCard({ classId, schoolId, onDone }) {
  const { data: pupils } = useQuery({
    queryKey:  ['pupils', classId],
    queryFn:   () => supabase
      .from('pupils')
      .select('id, full_name')
      .eq('class_id', classId)
      .order('full_name')
      .then(({ data }) => data ?? []),
    staleTime: 5 * 60_000,
  });

  const [form, setForm] = useState({
    pupil_id:     '',
    subject:      '',
    concern:      '',
    support_plan: '',
    review_date:  '',
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = useMutation({
    mutationFn: async () => {
      if (!form.pupil_id || !form.subject || !form.concern || !form.support_plan) {
        throw new Error('Pupil, subject, concern and plan are all required.');
      }
      const { error } = await supabase
        .from('interventions')
        .insert({
          pupil_id:     form.pupil_id,
          class_id:     classId,
          school_id:    schoolId,
          subject:      form.subject.trim(),
          concern:      form.concern.trim(),
          support_plan: form.support_plan.trim(),
          review_date:  form.review_date || null,
        });
      if (error) throw new Error(error.message);
      logAuditEvent({
        action:  'intervention.created',
        details: { class_id: classId, pupil_id: form.pupil_id, subject: form.subject },
      });
    },
    onSuccess: onDone,
  });

  return (
    <Card className="bg-surface-2 border-gold-400/20 mb-s-5">
      <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-5">
        New intervention
      </div>
      <div className="space-y-s-4">
        <div className="grid sm:grid-cols-2 gap-s-4">
          <Field label="Pupil *">
            <select
              value={form.pupil_id}
              onChange={(e) => set('pupil_id', e.target.value)}
              className="w-full bg-surface-3 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-body text-ink-0 outline-none focus:border-gold-400"
            >
              <option value="">Select pupil…</option>
              {pupils?.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
          </Field>
          <Field label="Subject *">
            <input
              className="w-full bg-surface-3 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-body text-ink-0 outline-none focus:border-gold-400"
              value={form.subject}
              onChange={(e) => set('subject', e.target.value)}
              placeholder="e.g. Mathematics"
            />
          </Field>
        </div>

        <Field label="Concern *">
          <textarea
            rows={2}
            className="w-full bg-surface-3 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-body text-ink-0 outline-none focus:border-gold-400 resize-none"
            value={form.concern}
            onChange={(e) => set('concern', e.target.value)}
            placeholder="Describe what you've observed…"
          />
        </Field>

        <Field label="Support plan *">
          <textarea
            rows={3}
            className="w-full bg-surface-3 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-body text-ink-0 outline-none focus:border-gold-400 resize-none"
            value={form.support_plan}
            onChange={(e) => set('support_plan', e.target.value)}
            placeholder="Steps you will take to support this pupil…"
          />
        </Field>

        <Field label="Review date" hint="Optional — when will you check progress?">
          <input
            type="date"
            min={new Date().toISOString().slice(0, 10)}
            className="bg-surface-3 border border-line-2 rounded-r-2 px-s-4 py-s-3 font-mono text-body text-ink-0 outline-none focus:border-gold-400"
            value={form.review_date}
            onChange={(e) => set('review_date', e.target.value)}
          />
        </Field>

        {submit.error && (
          <div className="text-[13px] text-red-400 bg-red-400/10 border border-red-400/30 rounded-r-2 px-s-4 py-s-3">
            {friendlyError(submit.error)}
          </div>
        )}

        <div className="flex gap-s-3 justify-end">
          <Button intent="ghost" size="md" onClick={onDone}>Cancel</Button>
          <Button
            intent="primary"
            size="md"
            onClick={() => submit.mutate()}
            disabled={submit.isPending}
          >
            {submit.isPending ? 'Creating…' : 'Create intervention'}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="flex flex-col gap-s-2">
      <label className="font-mono text-eyebrow uppercase text-ink-3">{label}</label>
      {children}
      {hint && <span className="font-mono text-[11px] text-ink-3 italic">{hint}</span>}
    </div>
  );
}
