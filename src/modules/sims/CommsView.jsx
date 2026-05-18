/**
 * src/modules/sims/CommsView.jsx
 *
 * Teacher-facing parent communications hub.
 * Route: /app/teacher/comms  (added to TeacherApp)
 *
 * TWO PANELS
 * ──────────
 * LEFT — Class selector + pupil list with last-contact summary
 *   - Pick a class from the teacher's classes
 *   - Each pupil row shows: last contact date, note count, follow-up badge
 *   - Click a pupil → opens the right panel
 *
 * RIGHT — Pupil comms drawer
 *   - Full note history for the selected pupil (newest first)
 *   - Write note form: body, type, share toggle, follow-up flag
 *   - WhatsApp quick-action: pre-fills message with pupil name + school name,
 *     logs the intent, opens wa.me on the teacher's device
 *   - Each existing note: toggle share, resolve follow-up, delete
 *
 * DESIGN DECISIONS
 * ─────────────────
 * - No dedicated "parent phone number" field on pupils yet; we prompt the
 *   teacher to enter the number inline when they open WhatsApp. v2 will pull
 *   it from a parent_contacts table once we add parent profile management.
 * - The "share with parent" toggle shows immediately after saving — teachers
 *   often write a private draft first, then decide to share.
 * - Follow-up date is optional — "follow up needed" without a date puts it in
 *   the general queue; a date surfaces it on the right day on the dashboard.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import * as simsService from '@/services/simsService';
import * as commsService from '@/services/commsService';
import { friendlyError } from '@/utils/friendlyError';
import { cn } from '@/utils/cn';

const TEACHER_NAV = [
  { to: '/app/teacher',            label: 'Dashboard', end: true },
  { to: '/app/teacher/attendance', label: 'Attendance' },
  { to: '/app/teacher/gradebook',  label: 'Gradebook'  },
  { to: '/app/teacher/reports',    label: 'Reports'    },
  { to: '/app/teacher/comms',      label: 'Comms'      },
];

const CONTACT_TYPES = [
  { value: 'note',     label: 'Note'       },
  { value: 'call',     label: 'Call'       },
  { value: 'meeting',  label: 'Meeting'    },
  { value: 'other',    label: 'Other'      },
];

export function CommsView() {
  const { schoolId } = useAuth();
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [selectedPupil, setSelectedPupil]     = useState(null);  // { id, full_name, ... }

  // Load teacher's classes
  const classesQ = useQuery({
    queryKey: ['teacher', 'myClasses', schoolId],
    queryFn:  () => simsService.getMyClasses(),
    enabled:  !!schoolId,
    staleTime: 300_000,
  });

  const classes = classesQ.data ?? [];

  // Auto-select first class
  const activeClassId = selectedClassId ?? classes[0]?.id ?? null;

  return (
    <AppShell title="Comms" navItems={TEACHER_NAV}>
      <div className="max-w-[1100px]">
        <div className="mb-s-7">
          <div className="font-mono text-eyebrow uppercase text-gold-400">Parent communications</div>
          <h2 className="mt-s-2 font-display text-display-2 text-ink-0">Comms log.</h2>
          <p className="mt-s-2 text-body text-ink-3 max-w-[58ch]">
            Write notes, log calls, and open WhatsApp for any pupil's parent.
            Notes marked "Share with parent" appear in the parent's app.
          </p>
        </div>

        <div className="grid lg:grid-cols-[320px_1fr] gap-s-5 items-start">
          {/* Left: class + pupil list */}
          <div className="space-y-s-4">
            {/* Class picker */}
            {classes.length > 1 && (
              <div className="bg-surface-2 border border-line-1 rounded-r-2 p-s-4">
                <div className="font-mono text-meta text-ink-3 mb-s-2 uppercase">Class</div>
                <select
                  value={activeClassId ?? ''}
                  onChange={(e) => { setSelectedClassId(e.target.value); setSelectedPupil(null); }}
                  className="w-full bg-surface-3 border border-line-2 rounded-r-2 px-s-3 py-s-2 text-[14px] text-ink-0 outline-none focus:border-gold-400"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Pupil list with comms summary */}
            {activeClassId && (
              <PupilList
                classId={activeClassId}
                selectedPupilId={selectedPupil?.id}
                onSelect={setSelectedPupil}
              />
            )}

            {!activeClassId && !classesQ.isLoading && (
              <Card className="bg-surface-2 border-line-2">
                <p className="text-body text-ink-3">No classes assigned to your account yet.</p>
              </Card>
            )}
          </div>

          {/* Right: pupil comms drawer */}
          <div>
            {selectedPupil
              ? (
                <PupilCommsPanel
                  pupil={selectedPupil}
                  schoolId={schoolId}
                  classId={activeClassId}
                />
              )
              : (
                <Card className="bg-surface-2 border-line-2 text-center py-s-10">
                  <p className="text-body text-ink-3">Select a pupil to view and write notes.</p>
                </Card>
              )
            }
          </div>
        </div>
      </div>
    </AppShell>
  );
}

// ── Pupil list ─────────────────────────────────────────────────────────────────

function PupilList({ classId, selectedPupilId, onSelect }) {
  const summaryQ = useQuery({
    queryKey: ['comms', 'summary', classId],
    queryFn:  () => commsService.getClassCommsSummary(classId),
    enabled:  !!classId,
    staleTime: 30_000,
  });

  const pupilsQ = useQuery({
    queryKey: ['pupils', classId],
    queryFn:  () => simsService.getPupilsInClass(classId),
    enabled:  !!classId,
    staleTime: 300_000,
  });

  const pupils   = pupilsQ.data ?? [];
  const summary  = summaryQ.data ?? [];
  const summaryMap = new Map(summary.map((s) => [s.pupil_id, s]));

  if (pupilsQ.isLoading) {
    return <div className="space-y-s-2">{[1,2,3,4].map((i) => <div key={i} className="h-14 rounded-r-2 bg-surface-2 animate-pulse"/>)}</div>;
  }

  if (pupils.length === 0) {
    return <Card className="bg-surface-2 border-line-2"><p className="text-body text-ink-3">No pupils in this class.</p></Card>;
  }

  return (
    <div className="bg-surface-2 border border-line-1 rounded-r-2 overflow-hidden">
      {pupils.map((pupil, idx) => {
        const s = summaryMap.get(pupil.id);
        const isSelected = pupil.id === selectedPupilId;
        return (
          <button
            key={pupil.id}
            onClick={() => onSelect(pupil)}
            className={cn(
              'w-full text-left px-s-4 py-s-3 border-b border-line-2 last:border-0 transition-colors',
              isSelected ? 'bg-gold-400/10' : 'hover:bg-surface-3',
            )}
          >
            <div className="flex items-center justify-between gap-s-2">
              <div className="min-w-0">
                <div className={cn('text-[14px] font-medium truncate', isSelected ? 'text-gold-200' : 'text-ink-1')}>
                  {pupil.full_name}
                </div>
                {s?.last_contact_at ? (
                  <div className="font-mono text-[11px] text-ink-3 mt-[2px]">
                    {commsService.fmtContactDate(s.last_contact_at)}
                    {s.total_notes > 0 && <> · {s.total_notes} note{s.total_notes !== 1 ? 's' : ''}</>}
                  </div>
                ) : (
                  <div className="font-mono text-[11px] text-ink-4 mt-[2px]">No contact yet</div>
                )}
              </div>
              <div className="flex gap-s-1 shrink-0">
                {s?.follow_up_needed && (
                  <Chip variant="amber" dot size="sm">Follow-up</Chip>
                )}
                {s?.shared_notes > 0 && (
                  <span className="font-mono text-[10px] text-gold-400 border border-gold-400/30 rounded-full px-[6px] py-[2px]">
                    {s.shared_notes} shared
                  </span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Pupil comms panel ──────────────────────────────────────────────────────────

function PupilCommsPanel({ pupil, schoolId, classId }) {
  const qc = useQueryClient();

  const [form, setForm] = useState({
    contactType:      'note',
    body:             '',
    sharedWithParent: false,
    followUpNeeded:   false,
    followUpDate:     '',
  });
  const [showWaForm, setShowWaForm] = useState(false);
  const [waPhone, setWaPhone]       = useState('');
  const [waMsg,   setWaMsg]         = useState('');
  const [error, setError]           = useState(null);

  const commsQ = useQuery({
    queryKey: ['comms', 'pupil', pupil.id],
    queryFn:  () => commsService.getPupilComms(pupil.id),
    enabled:  !!pupil.id,
    staleTime: 15_000,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['comms', 'pupil', pupil.id] });
    qc.invalidateQueries({ queryKey: ['comms', 'summary', classId] });
  };

  const writeMut = useMutation({
    mutationFn: () => commsService.writeCommsEntry({
      schoolId,
      pupilId:          pupil.id,
      classId,
      contactType:      form.contactType,
      body:             form.body,
      sharedWithParent: form.sharedWithParent,
      followUpNeeded:   form.followUpNeeded,
      followUpDate:     form.followUpDate || null,
    }),
    onSuccess: () => {
      invalidate();
      setForm({ contactType: 'note', body: '', sharedWithParent: false, followUpNeeded: false, followUpDate: '' });
      setError(null);
    },
    onError: (e) => setError(friendlyError(e)),
  });

  const waMut = useMutation({
    mutationFn: () => commsService.logAndOpenWhatsApp({
      schoolId,
      pupilId:  pupil.id,
      classId,
      phoneNumber:  waPhone,
      messageBody:  waMsg,
    }),
    onSuccess: (url) => {
      invalidate();
      window.open(url, '_blank', 'noopener,noreferrer');
      // Persist the phone number to the parent's profile (silently, background)
      // so teachers don't have to retype it next time.
      commsService.saveParentPhoneForPupil(pupil.id, waPhone).catch(() => {});
      setShowWaForm(false);
      setWaPhone('');
      setWaMsg('');
    },
    onError: (e) => setError(friendlyError(e)),
  });

  const shareMut = useMutation({
    mutationFn: ({ id, shared }) => commsService.toggleShared(id, shared),
    onSuccess: invalidate,
  });

  const resolveMut = useMutation({
    mutationFn: (id) => commsService.resolveFollowUp(id),
    onSuccess: invalidate,
  });

  const deleteMut = useMutation({
    mutationFn: (id) => commsService.deleteCommsEntry(id),
    onSuccess: invalidate,
  });

  const entries = commsQ.data ?? [];

  return (
    <div className="space-y-s-5">
      {/* Pupil header */}
      <div className="flex items-center gap-s-4">
        <div>
          <h3 className="font-display text-display-3 text-ink-0">{pupil.full_name}</h3>
          {pupil.pupil_code && (
            <div className="font-mono text-meta text-ink-3">{pupil.pupil_code}</div>
          )}
        </div>
        <div className="ml-auto">
          <Button
            intent={showWaForm ? 'ghost' : 'primary'}
            size="sm"
            onClick={async () => {
              setShowWaForm((v) => !v);
              if (!showWaForm) {
                setWaMsg(`Hello, this is ${pupil.full_name?.split(' ')[0]}'s class teacher. I'd like to briefly discuss their progress. When would be a good time to talk?`);
                // Try to pre-fill phone from linked parent's profile
                if (!waPhone) {
                  try {
                    const { supabase } = await import('@/lib/supabase');
                    const { data: links } = await supabase
                      .from('parent_pupil_links')
                      .select('profiles!parent_user_id(phone)')
                      .eq('pupil_id', pupil.id)
                      .limit(1);
                    const phone = links?.[0]?.profiles?.phone;
                    if (phone) setWaPhone(phone);
                  } catch { /* silently skip */ }
                }
              }
            }}
          >
            💬 WhatsApp
          </Button>
        </div>
      </div>

      {/* WhatsApp quick panel */}
      {showWaForm && (
        <Card className="bg-surface-2 border border-gold-400/30">
          <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-4">Open WhatsApp</div>
          <p className="text-[13px] text-ink-3 mb-s-4">
            Enter the parent's number, edit the message, then click Open. We'll
            log the intent and open WhatsApp on your device.
          </p>
          <div className="space-y-s-3">
            <div>
              <label className="block font-mono text-meta text-ink-3 mb-s-1">Parent phone number</label>
              <input
                type="tel"
                value={waPhone}
                onChange={(e) => setWaPhone(e.target.value)}
                placeholder="+234 801 234 5678"
                className="w-full bg-surface-3 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[14px] text-ink-0 outline-none focus:border-gold-400 font-mono"
              />
            </div>
            <div>
              <label className="block font-mono text-meta text-ink-3 mb-s-1">Message</label>
              <textarea
                value={waMsg}
                onChange={(e) => setWaMsg(e.target.value)}
                rows={4}
                className="w-full bg-surface-3 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[14px] text-ink-0 outline-none focus:border-gold-400 resize-none"
                maxLength={500}
              />
              <div className="font-mono text-[11px] text-ink-3 text-right mt-s-1">{waMsg.length}/500</div>
            </div>
            <div className="flex gap-s-3">
              <Button
                intent="primary" size="md"
                onClick={() => { setError(null); waMut.mutate(); }}
                isLoading={waMut.isPending}
                disabled={!waPhone.trim() || !waMsg.trim()}
              >
                Open WhatsApp →
              </Button>
              <Button intent="ghost" size="md" onClick={() => setShowWaForm(false)}>Cancel</Button>
            </div>
          </div>
        </Card>
      )}

      {/* Write note form */}
      <Card className="bg-surface-2 border-line-2">
        <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-4">Write a note</div>

        <div className="space-y-s-3">
          {/* Type selector */}
          <div className="flex flex-wrap gap-s-2">
            {CONTACT_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setForm((f) => ({ ...f, contactType: t.value }))}
                className={cn(
                  'px-s-4 py-[6px] rounded-full text-[12.5px] font-medium border transition-all duration-150',
                  form.contactType === t.value
                    ? 'bg-gold-400/15 border-gold-400/40 text-gold-200'
                    : 'bg-surface-3 border-line-2 text-ink-2 hover:text-ink-1',
                )}
              >
                {commsService.CONTACT_TYPE_ICON[t.value]} {t.label}
              </button>
            ))}
          </div>

          {/* Note body */}
          <textarea
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            rows={4}
            placeholder={
              form.contactType === 'note'
                ? 'Write your note here…'
                : form.contactType === 'call'
                ? 'What was discussed on the call…'
                : form.contactType === 'meeting'
                ? 'What was discussed in the meeting…'
                : 'Add details…'
            }
            className="w-full bg-surface-3 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[14px] text-ink-0 outline-none focus:border-gold-400 resize-none"
            maxLength={2000}
          />

          {/* Options row */}
          <div className="flex flex-wrap gap-s-5 items-center">
            <label className="flex items-center gap-s-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.sharedWithParent}
                onChange={(e) => setForm((f) => ({ ...f, sharedWithParent: e.target.checked }))}
                className="accent-gold-400 w-4 h-4"
              />
              <span className="text-[13.5px] text-ink-2">Share with parent</span>
            </label>

            <label className="flex items-center gap-s-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.followUpNeeded}
                onChange={(e) => setForm((f) => ({ ...f, followUpNeeded: e.target.checked }))}
                className="accent-gold-400 w-4 h-4"
              />
              <span className="text-[13.5px] text-ink-2">Follow-up needed</span>
            </label>

            {form.followUpNeeded && (
              <input
                type="date"
                value={form.followUpDate}
                onChange={(e) => setForm((f) => ({ ...f, followUpDate: e.target.value }))}
                className="bg-surface-3 border border-line-2 rounded-r-2 px-s-3 py-[6px] text-[13px] text-ink-0 outline-none focus:border-gold-400"
              />
            )}
          </div>

          {error && <div className="text-[13px] text-red-400">{error}</div>}

          <Button
            intent="primary" size="md"
            onClick={() => { setError(null); writeMut.mutate(); }}
            isLoading={writeMut.isPending}
            disabled={!form.body.trim()}
          >
            Save note
          </Button>
        </div>
      </Card>

      {/* Note history */}
      {commsQ.isLoading
        ? <div className="space-y-s-2">{[1,2,3].map((i) => <div key={i} className="h-16 rounded-r-2 bg-surface-2 animate-pulse"/>)}</div>
        : entries.length === 0
          ? (
            <Card className="bg-surface-2 border-line-2 text-center py-s-6">
              <p className="text-body text-ink-3">No notes yet for {pupil.full_name}.</p>
            </Card>
          )
          : (
            <div className="space-y-s-3">
              {entries.map((entry) => (
                <CommsEntry
                  key={entry.id}
                  entry={entry}
                  onShare={(shared) => shareMut.mutate({ id: entry.id, shared })}
                  onResolve={() => resolveMut.mutate(entry.id)}
                  onDelete={() => { if (window.confirm('Delete this note?')) deleteMut.mutate(entry.id); }}
                />
              ))}
            </div>
          )
      }
    </div>
  );
}

// ── Single comms entry card ────────────────────────────────────────────────────

function CommsEntry({ entry, onShare, onResolve, onDelete }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="bg-surface-2 border-line-2">
      <div className="flex items-start gap-s-3">
        <div className="text-[18px] mt-[2px] shrink-0">
          {commsService.CONTACT_TYPE_ICON[entry.contact_type] ?? '📋'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-s-2 flex-wrap mb-s-1">
            <span className="font-mono text-[11px] text-ink-3 uppercase tracking-[0.1em]">
              {commsService.CONTACT_TYPE_LABEL[entry.contact_type] ?? 'Note'}
            </span>
            <span className="font-mono text-[11px] text-ink-3">·</span>
            <span className="font-mono text-[11px] text-ink-3">
              {commsService.fmtContactDate(entry.created_at)}
            </span>
            {entry.author_name && (
              <>
                <span className="font-mono text-[11px] text-ink-3">·</span>
                <span className="font-mono text-[11px] text-ink-3">{entry.author_name}</span>
              </>
            )}
          </div>

          {entry.body && (
            <p className={cn('text-[14px] text-ink-1 leading-relaxed', !expanded && 'line-clamp-2')}>
              {entry.body}
            </p>
          )}
          {entry.body?.length > 120 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="font-mono text-[11px] text-gold-400 mt-s-1"
            >
              {expanded ? 'Show less' : 'Read more'}
            </button>
          )}

          <div className="flex flex-wrap items-center gap-s-3 mt-s-3">
            {entry.shared_with_parent
              ? (
                <button
                  onClick={() => onShare(false)}
                  className="flex items-center gap-s-1 font-mono text-[11px] text-green-400 hover:text-red-400 transition-colors"
                >
                  ✓ Shared · click to hide
                </button>
              )
              : (
                <button
                  onClick={() => onShare(true)}
                  className="flex items-center gap-s-1 font-mono text-[11px] text-ink-3 hover:text-gold-400 transition-colors"
                >
                  Share with parent
                </button>
              )
            }

            {entry.follow_up_needed && (
              <>
                <span className="font-mono text-[11px] text-ink-3">·</span>
                <button
                  onClick={onResolve}
                  className="flex items-center gap-s-1 font-mono text-[11px] text-amber-400 hover:text-green-400 transition-colors"
                >
                  ⚑ Follow-up
                  {entry.follow_up_date && ` by ${new Date(entry.follow_up_date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}`}
                  · Resolve
                </button>
              </>
            )}

            <span className="font-mono text-[11px] text-ink-3 ml-auto">
              <button onClick={onDelete} className="hover:text-red-400 transition-colors">Delete</button>
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
