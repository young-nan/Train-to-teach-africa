/**
 * src/services/commsService.js
 *
 * Parent communications log. Every teacher → parent contact is recorded
 * here: written notes, WhatsApp intents, calls, meetings.
 *
 * WHAT THIS IS
 * ─────────────
 * A contact log, not an inbox. v1 is one-directional: staff write, parents
 * read entries explicitly shared with them. Full two-way messaging is v2.
 *
 * WHATSAPP
 * ────────
 * We don't send via API in v1. We construct a wa.me deep-link with the
 * pre-filled message and open it on the teacher's device. The teacher
 * sends from their own WhatsApp. We log the intent so there's an audit
 * trail of "this message was prepared and opened."
 *
 * The whatsappFormatter.js service builds the message text; this service
 * builds the full wa.me URL and records the log entry.
 */

import { supabase } from '@/lib/supabase';
import { logAuditEvent } from './auditService';

// ── Teacher / staff: reading ──────────────────────────────────────────────────

/**
 * Per-pupil comms summary for a class.
 * Returns [{ pupil_id, pupil_name, total_notes, shared_notes,
 *             last_contact_at, follow_up_needed, follow_up_date }]
 *
 * Used by the teacher's class comms hub to surface who needs attention.
 */
export async function getClassCommsSummary(classId) {
  const { data, error } = await supabase.rpc('get_class_comms_summary', {
    p_class_id: classId,
  });
  if (error) throw new Error(`Could not load comms summary: ${error.message}`);
  return data ?? [];
}

/**
 * Full note history for a single pupil (newest first).
 * Staff see all entries. Parents only see shared_with_parent=true entries
 * (enforced by RLS on the table + the RPC).
 */
export async function getPupilComms(pupilId, { limit = 50, offset = 0 } = {}) {
  const { data, error } = await supabase.rpc('get_pupil_comms', {
    p_pupil_id: pupilId,
    p_limit:    limit,
    p_offset:   offset,
  });
  if (error) throw new Error(`Could not load pupil comms: ${error.message}`);
  return data ?? [];
}

/**
 * Pending follow-ups for the caller's school.
 * Returns notes where follow_up_needed=true and follow_up_date <= today (or null).
 * Used by the teacher dashboard to show "who needs a call."
 */
export async function getPendingFollowUps(schoolId) {
  const { data, error } = await supabase
    .from('parent_comms')
    .select(`
      id, pupil_id, contact_type, body, follow_up_date,
      pupils(full_name, pupil_code, classes(name))
    `)
    .eq('school_id', schoolId)
    .eq('follow_up_needed', true)
    .order('follow_up_date', { nullsFirst: true })
    .limit(20);
  if (error) throw new Error(`Could not load follow-ups: ${error.message}`);
  return (data ?? []).map((r) => ({
    ...r,
    pupilName:  r.pupils?.full_name  ?? '—',
    pupilCode:  r.pupils?.pupil_code ?? '',
    className:  r.pupils?.classes?.name ?? '—',
  }));
}

// ── Teacher / staff: writing ──────────────────────────────────────────────────

/**
 * Write a note or log a contact event for a pupil.
 *
 * @param {object} params
 *   - schoolId, pupilId, classId (optional)
 *   - contactType: 'note' | 'whatsapp' | 'call' | 'meeting' | 'other'
 *   - body: string (the note text — required for 'note', encouraged for others)
 *   - sharedWithParent: boolean (default false)
 *   - followUpNeeded: boolean (default false)
 *   - followUpDate: ISO date string (optional)
 *   - whatsappPreview: string (optional — the pre-filled WA message text)
 */
export async function writeCommsEntry({
  schoolId,
  pupilId,
  classId,
  contactType = 'note',
  body,
  sharedWithParent = false,
  ccHeadTeacher    = false,
  followUpNeeded   = false,
  followUpDate     = null,
  whatsappPreview  = null,
}) {
  if (!body?.trim() && contactType === 'note') {
    throw new Error('Note body is required.');
  }

  const { data, error } = await supabase
    .from('parent_comms')
    .insert({
      school_id:          schoolId,
      pupil_id:           pupilId,
      class_id:           classId ?? null,
      contact_type:       contactType,
      body:               body?.trim() ?? null,
      shared_with_parent: sharedWithParent,
      cc_head_teacher:    ccHeadTeacher,
      follow_up_needed:   followUpNeeded,
      follow_up_date:     followUpDate ?? null,
      whatsapp_preview:   whatsappPreview ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`Could not save note: ${error.message}`);

  logAuditEvent({
    action:        `comms.${contactType}_logged`,
    targetPupilId: pupilId,
    targetSchoolId: schoolId,
    details: {
      contact_type:      contactType,
      shared:            sharedWithParent,
      follow_up_needed:  followUpNeeded,
    },
  });

  return data;
}

/**
 * Toggle the shared_with_parent flag on an existing entry.
 * Head teachers can share notes retrospectively without rewriting them.
 */
export async function toggleShared(entryId, sharedWithParent) {
  const { data, error } = await supabase
    .from('parent_comms')
    .update({ shared_with_parent: sharedWithParent, updated_at: new Date().toISOString() })
    .eq('id', entryId)
    .select()
    .single();
  if (error) throw new Error(`Could not update: ${error.message}`);
  return data;
}

/**
 * Mark a follow-up as resolved (clears the follow_up_needed flag).
 */
export async function resolveFollowUp(entryId) {
  const { data, error } = await supabase
    .from('parent_comms')
    .update({ follow_up_needed: false, updated_at: new Date().toISOString() })
    .eq('id', entryId)
    .select()
    .single();
  if (error) throw new Error(`Could not resolve: ${error.message}`);
  logAuditEvent({ action: 'comms.follow_up_resolved', details: { entry_id: entryId } });
  return data;
}

/**
 * Delete a comms entry. Staff-only — never called from parent side.
 * (Soft-delete could be added later; v1 uses hard delete.)
 */
export async function deleteCommsEntry(entryId) {
  const { error } = await supabase
    .from('parent_comms')
    .delete()
    .eq('id', entryId);
  if (error) throw new Error(`Could not delete: ${error.message}`);
  logAuditEvent({ action: 'comms.entry_deleted', details: { entry_id: entryId } });
}

// ── WhatsApp helpers ──────────────────────────────────────────────────────────

/**
 * Build a wa.me deep link with a pre-filled message.
 *
 * @param {string} phoneNumber  — in international format, e.g. "+2348012345678"
 * @param {string} messageBody  — the pre-filled text (plaintext, no markdown)
 * @returns {string}            — the wa.me URL to open on the device
 */
export function buildWhatsAppLink(phoneNumber, messageBody) {
  // Strip everything except digits and leading +
  const cleaned = String(phoneNumber ?? '').replace(/[^\d+]/g, '');
  // wa.me wants the number without + and without leading 0
  const num = cleaned.startsWith('+') ? cleaned.slice(1) : cleaned;
  const encoded = encodeURIComponent(messageBody ?? '');
  return `https://wa.me/${num}?text=${encoded}`;
}

/**
 * Log a WhatsApp intent and return the wa.me URL to open.
 * Combines writeCommsEntry + buildWhatsAppLink in one call so the teacher
 * UI only needs one action to "log + open WhatsApp."
 */
export async function logAndOpenWhatsApp({
  schoolId,
  pupilId,
  classId,
  phoneNumber,
  messageBody,
  followUpNeeded = false,
  followUpDate   = null,
}) {
  // Log the intent first — even if they don't actually send, there's a record
  await writeCommsEntry({
    schoolId,
    pupilId,
    classId,
    contactType:      'whatsapp',
    body:             `WhatsApp opened. Message: "${messageBody?.slice(0, 120)}${messageBody?.length > 120 ? '…' : ''}"`,
    sharedWithParent: false,   // WhatsApp intents are internal by default
    whatsappPreview:  messageBody,
    followUpNeeded,
    followUpDate,
  });

  return buildWhatsAppLink(phoneNumber, messageBody);
}

// ── Parent-facing ─────────────────────────────────────────────────────────────

/**
 * Returns comms shared with the parent for a specific pupil.
 * RLS enforces that the caller is actually linked to this pupil.
 */
export async function getMyChildComms(pupilId) {
  const { data, error } = await supabase
    .from('parent_comms')
    .select('id, contact_type, body, created_at')
    .eq('pupil_id', pupilId)
    .eq('shared_with_parent', true)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw new Error(`Could not load messages: ${error.message}`);
  return data ?? [];
}

// ── Parent phone persistence ──────────────────────────────────────────────────

/**
 * Save a phone number to the profile of the parent linked to a pupil.
 * Called when a teacher enters a phone number in the WhatsApp form.
 * Silently no-ops if no parent is linked or if the number is unchanged.
 *
 * Only updates the parent's profile if their current phone is null/empty
 * — we never overwrite a number the parent set themselves.
 */
export async function saveParentPhoneForPupil(pupilId, phoneE164) {
  if (!pupilId || !phoneE164) return;

  // Find parent linked to this pupil
  const { data: links } = await supabase
    .from('parent_pupil_links')
    .select('parent_user_id')
    .eq('pupil_id', pupilId)
    .limit(1);

  const parentUserId = links?.[0]?.parent_user_id;
  if (!parentUserId) return;

  // Only write if parent currently has no phone on record
  const { data: existing } = await supabase
    .from('profiles')
    .select('phone')
    .eq('user_id', parentUserId)
    .single();

  if (existing?.phone) return; // already has a number — don't overwrite

  await supabase
    .from('profiles')
    .update({ phone: phoneE164, updated_at: new Date().toISOString() })
    .eq('user_id', parentUserId);
}


export const CONTACT_TYPE_LABEL = {
  note:     'Note',
  whatsapp: 'WhatsApp',
  call:     'Phone call',
  meeting:  'Meeting',
  other:    'Other',
};

export const CONTACT_TYPE_ICON = {
  note:     '📝',
  whatsapp: '💬',
  call:     '📞',
  meeting:  '🤝',
  other:    '📋',
};

export function fmtContactDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7)  return `${diffDays} days ago`;
  return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}


// ── Parent replies ────────────────────────────────────────────────────────────

/**
 * Send a parent reply to a school note.
 * @param {string} commsId  - parent_comms row the parent is replying to
 * @param {string} pupilId  - which child this reply is about
 * @param {string} schoolId - the school that sent the original note
 * @param {string} body     - the reply text (max 1000 chars)
 */
export async function sendParentReply({ commsId, pupilId, schoolId, body }) {
  if (!body?.trim()) throw new Error('Reply cannot be empty.');
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated.');

  const { data, error } = await supabase
    .from('parent_replies')
    .insert({
      comms_id:  commsId,
      pupil_id:  pupilId,
      school_id: schoolId,
      parent_id: user.id,
      body:      body.trim(),
    })
    .select()
    .single();

  if (error) throw new Error(`Could not send reply: ${error.message}`);
  return data;
}

/**
 * Fetch parent replies for a specific comms entry.
 * Used by teachers in CommsView to see parent responses.
 */
export async function getParentRepliesForComms(commsId) {
  const { data, error } = await supabase
    .from('parent_replies')
    .select('id, body, created_at, profiles(full_name)')
    .eq('comms_id', commsId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`Could not load replies: ${error.message}`);
  return data ?? [];
}

/**
 * Fetch all replies for a pupil's messages (parent-facing).
 * Returns replies keyed by comms_id so the UI can thread them.
 */
export async function getMyRepliesForPupil(pupilId) {
  const { data, error } = await supabase
    .from('parent_replies')
    .select('id, comms_id, body, created_at')
    .eq('pupil_id', pupilId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`Could not load replies: ${error.message}`);
  // Group by comms_id for easy lookup
  return (data ?? []).reduce((acc, r) => {
    (acc[r.comms_id] ??= []).push(r);
    return acc;
  }, {});
}
