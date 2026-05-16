/**
 * src/services/schoolConnectionService.js
 *
 * Manages the parent ↔ school connection lifecycle.
 *
 * This is the implementation of the "firewall" described in the architecture:
 * parents do NOT automatically receive school data when linked to a pupil.
 * They must explicitly request a connection, and the school must approve it,
 * configuring exactly which data types are shared.
 *
 * WHO CALLS THIS
 * ──────────────
 * Parent side:
 *   ChildEnrolmentView / SchoolConnectionView
 *   — request a connection, view pending/approved connections
 *
 * School admin side:
 *   AdminApp → ConnectionsView (new tab, Part 3 of this build)
 *   — see pending requests, approve/reject, configure sharing
 *
 * WORKFLOW
 * ────────
 * 1. Parent calls requestConnection({ schoolId, claimedChildName, claimedClassName })
 *    → parent_school_connections row (status: pending)
 * 2. School admin sees it in /app/admin/connections (pending tab)
 * 3. Admin calls approveConnection({ connectionId, pupilId, shareConfig })
 *    → status: approved + pupil_id set + share_* flags configured
 *    → parent_pupil_links row created so parent can now see school pupil data
 * 4. Admin can later revokeConnection(connectionId)
 *    → status: revoked, parent loses school data access
 */

import { supabase } from '@/lib/supabase';
import { logAuditEvent } from './auditService';

// ── Parent-side operations ────────────────────────────────────────────────────

/**
 * Parent requests a connection to a school.
 * The school admin will review and approve/reject.
 *
 * A parent can have one pending/approved connection per school.
 * If they already have one, this throws with a clear message.
 */
export async function requestConnection({ schoolId, claimedChildName, claimedClassName }) {
  if (!claimedChildName?.trim()) {
    throw new Error('Your child\'s name is required so the school can identify them.');
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Sign in to request a school connection.');

  // Check for existing connection to this school
  const { data: existing } = await supabase
    .from('parent_school_connections')
    .select('id, status')
    .eq('parent_user_id', user.id)
    .eq('school_id', schoolId)
    .maybeSingle();

  if (existing) {
    const statusMessages = {
      pending:  'You already have a pending connection request to this school. They'll review it shortly.',
      approved: 'You're already connected to this school.',
      rejected: 'Your previous connection request to this school was declined. Contact the school directly.',
      revoked:  'Your connection to this school was revoked. Contact the school directly.',
    };
    throw new Error(statusMessages[existing.status] ?? 'A connection already exists with this school.');
  }

  const { data, error } = await supabase
    .from('parent_school_connections')
    .insert({
      parent_user_id:     user.id,
      school_id:          schoolId,
      claimed_child_name: claimedChildName.trim(),
      claimed_class_name: claimedClassName?.trim() ?? null,
      status:             'pending',
    })
    .select()
    .single();

  if (error) throw new Error(`Could not submit connection request: ${error.message}`);

  logAuditEvent({
    action:  'parent.school_connection_requested',
    details: { school_id: schoolId, claimed_child_name: claimedChildName },
  });

  return data;
}

/**
 * List the parent's school connections (all statuses).
 * Used by the parent Children view to show connection status per child.
 */
export async function listMyConnections() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('parent_school_connections')
    .select(`
      id, status, claimed_child_name, claimed_class_name,
      share_attendance, share_term_reports, share_score_summary,
      requested_at, reviewed_at, rejection_reason,
      schools(id, name, city, state),
      pupils(id, full_name, level)
    `)
    .eq('parent_user_id', user.id)
    .order('requested_at', { ascending: false });

  if (error) throw new Error(`Could not load connections: ${error.message}`);
  return data ?? [];
}

/**
 * Read approved school-shared attendance for a linked pupil.
 * Only returns data if parent has an approved connection with share_attendance=true.
 * Uses the parent_approved_attendance_v view for safe disclosure.
 */
export async function getApprovedAttendance(pupilId) {
  const { data, error } = await supabase
    .from('parent_approved_attendance_v')
    .select('*')
    .eq('pupil_id', pupilId)
    .order('week_start', { ascending: false })
    .limit(13);  // one term = 13 weeks

  if (error) {
    // Silently return empty — RLS denies access rather than throwing 403
    if (error.code === 'PGRST116' || error.message?.includes('permission')) return [];
    throw new Error(`Could not load attendance: ${error.message}`);
  }
  return data ?? [];
}

/**
 * Read approved school-shared score summary for a linked pupil.
 * Only returns data if parent has an approved connection with share_score_summary=true.
 */
export async function getApprovedScores(pupilId) {
  const { data, error } = await supabase
    .from('parent_approved_scores_v')
    .select('*')
    .eq('pupil_id', pupilId);

  if (error) {
    if (error.code === 'PGRST116' || error.message?.includes('permission')) return [];
    throw new Error(`Could not load scores: ${error.message}`);
  }
  return data ?? [];
}

// ── School admin operations ───────────────────────────────────────────────────

/**
 * List pending connection requests for the admin's school.
 * Used by /app/admin/connections pending tab.
 */
export async function listPendingConnections() {
  const { data, error } = await supabase
    .from('parent_school_connections')
    .select(`
      id, claimed_child_name, claimed_class_name, requested_at,
      profiles!parent_school_connections_parent_user_id_fkey(full_name, email, phone)
    `)
    .eq('status', 'pending')
    .order('requested_at', { ascending: true });  // oldest first = most urgent

  if (error) throw new Error(`Could not load pending connections: ${error.message}`);
  return data ?? [];
}

/**
 * List all connections for the admin's school (all statuses).
 * Used by the Approved and Rejected tabs.
 */
export async function listSchoolConnections({ status } = {}) {
  let q = supabase
    .from('parent_school_connections')
    .select(`
      id, status, claimed_child_name, claimed_class_name,
      share_attendance, share_term_reports, share_score_summary,
      requested_at, reviewed_at, rejection_reason,
      profiles!parent_school_connections_parent_user_id_fkey(full_name, email),
      pupils(id, full_name, level)
    `)
    .order('requested_at', { ascending: false });

  if (status) q = q.eq('status', status);

  const { data, error } = await q;
  if (error) throw new Error(`Could not load connections: ${error.message}`);
  return data ?? [];
}

/**
 * School admin approves a connection request.
 *
 * Steps:
 * 1. Update parent_school_connections: status='approved', link pupilId, set share flags
 * 2. Create parent_pupil_links row so parent's RLS policies can see the pupil
 *
 * @param {{
 *   connectionId: string,
 *   pupilId: string,        — the actual school pupil record to link
 *   shareConfig: {
 *     share_attendance: boolean,
 *     share_term_reports: boolean,
 *     share_score_summary: boolean,
 *   }
 * }} params
 */
export async function approveConnection({ connectionId, pupilId, shareConfig }) {
  const { data: { user } } = await supabase.auth.getUser();

  // 1. Update connection row
  const { data: conn, error: connErr } = await supabase
    .from('parent_school_connections')
    .update({
      status:              'approved',
      pupil_id:            pupilId,
      reviewed_at:         new Date().toISOString(),
      reviewed_by:         user.id,
      share_attendance:    shareConfig.share_attendance    ?? false,
      share_term_reports:  shareConfig.share_term_reports  ?? false,
      share_score_summary: shareConfig.share_score_summary ?? false,
      updated_at:          new Date().toISOString(),
    })
    .eq('id', connectionId)
    .select('parent_user_id')
    .single();

  if (connErr) throw new Error(`Could not approve connection: ${connErr.message}`);

  // 2. Create parent_pupil_links so the parent's RLS policies work
  const { error: linkErr } = await supabase
    .from('parent_pupil_links')
    .upsert(
      { parent_user_id: conn.parent_user_id, pupil_id: pupilId },
      { onConflict: 'parent_user_id,pupil_id' },
    );

  if (linkErr) throw new Error(`Could not link parent to pupil: ${linkErr.message}`);

  logAuditEvent({
    action:  'school.parent_connection_approved',
    details: { connection_id: connectionId, pupil_id: pupilId, share_config: shareConfig },
  });

  return conn;
}

/**
 * School admin rejects a connection request.
 */
export async function rejectConnection({ connectionId, reason }) {
  if (!reason?.trim()) throw new Error('A reason is required for declining a connection request.');

  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('parent_school_connections')
    .update({
      status:           'rejected',
      reviewed_at:      new Date().toISOString(),
      reviewed_by:      user.id,
      rejection_reason: reason.trim(),
      updated_at:       new Date().toISOString(),
    })
    .eq('id', connectionId)
    .select()
    .single();

  if (error) throw new Error(`Could not reject connection: ${error.message}`);

  logAuditEvent({
    action:  'school.parent_connection_rejected',
    details: { connection_id: connectionId, reason },
  });

  return data;
}

/**
 * School admin revokes a previously approved connection.
 * The parent_pupil_links row is NOT deleted (to preserve audit trail),
 * but the parent_school_connections status becomes 'revoked',
 * which the disclosure views check.
 */
export async function revokeConnection(connectionId) {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('parent_school_connections')
    .update({
      status:      'revoked',
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
      updated_at:  new Date().toISOString(),
    })
    .eq('id', connectionId)
    .select()
    .single();

  if (error) throw new Error(`Could not revoke connection: ${error.message}`);

  logAuditEvent({
    action:  'school.parent_connection_revoked',
    details: { connection_id: connectionId },
  });

  return data;
}

/**
 * Update sharing settings for an existing approved connection.
 * School admin can change what's shared without revoking and re-approving.
 */
export async function updateShareSettings({ connectionId, shareConfig }) {
  const { data, error } = await supabase
    .from('parent_school_connections')
    .update({
      share_attendance:    shareConfig.share_attendance    ?? false,
      share_term_reports:  shareConfig.share_term_reports  ?? false,
      share_score_summary: shareConfig.share_score_summary ?? false,
      updated_at:          new Date().toISOString(),
    })
    .eq('id', connectionId)
    .eq('status', 'approved')  // only update approved connections
    .select()
    .single();

  if (error) throw new Error(`Could not update sharing settings: ${error.message}`);

  logAuditEvent({
    action:  'school.connection_share_settings_updated',
    details: { connection_id: connectionId, new_config: shareConfig },
  });

  return data;
}

// ── School search (parent side) ───────────────────────────────────────────────

/**
 * Parent searches for a school by name (to initiate a connection request).
 * Only returns active schools. Limited columns — no internal data exposed.
 */
export async function searchSchools(query) {
  if (!query?.trim() || query.trim().length < 2) return [];

  const { data, error } = await supabase
    .from('schools')
    .select('id, name, city, state, slug')
    .eq('status', 'active')
    .ilike('name', `%${query.trim()}%`)
    .limit(10);

  if (error) throw new Error(`School search failed: ${error.message}`);
  return data ?? [];
}
