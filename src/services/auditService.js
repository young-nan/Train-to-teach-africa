/**
 * src/services/auditService.js
 *
 * Single entrypoint for writing audit-log events from the client.
 *
 * Design choices worth knowing:
 *
 * - FIRE AND FORGET. Audit writes never throw to the caller. If the audit
 *   log fails (network, permission, anything), we console.warn but don't
 *   block the user's actual action. Audit is a record, not a precondition.
 *
 * - NO BATCHING IN V1. Each event is one RPC call. Could batch later if
 *   write volume becomes a problem. Today it isn't.
 *
 * - ACTOR IS IMPLICIT. The RPC reads auth.uid() server-side. Callers
 *   cannot forge "actor" — the SQL function rejects manual overrides
 *   from authenticated callers (only edge functions with the service
 *   role key can override actor, for webhook events).
 *
 * Action naming convention: `<domain>.<verb>` in past tense.
 *   Examples: 'attendance.marked', 'gradebook.column_created',
 *             'gradebook.scores_saved', 'subscription.activated'
 */

import { supabase } from '@/lib/supabase';

/**
 * @param {object} event
 *   - action: string. Required. Use the `<domain>.<verb>` convention.
 *   - targetUserId: uuid. Optional. The user the action applies to.
 *   - targetPupilId: uuid. Optional. The pupil the action applies to.
 *   - targetSchoolId: uuid. Optional. The school the action applies to.
 *   - details: object. Optional. Free-form JSONB payload.
 */
export async function logAuditEvent(event) {
  if (!event?.action) {
    console.warn('[audit] dropped event with no action');
    return;
  }

  try {
    const { error } = await supabase.rpc('log_audit_event', {
      p_action: event.action,
      p_target_user_id: event.targetUserId ?? null,
      p_target_pupil_id: event.targetPupilId ?? null,
      p_target_school_id: event.targetSchoolId ?? null,
      p_details: event.details ?? null,
    });
    if (error) {
      // Audit failures are logged but never re-thrown. The caller's
      // action has already succeeded; we don't undo it because logging
      // failed.
      console.warn('[audit] write failed for action', event.action, error.message);
    }
  } catch (e) {
    console.warn('[audit] threw for action', event.action, e?.message);
  }
}
