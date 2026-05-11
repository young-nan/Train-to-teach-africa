/**
 * src/services/staffService.js
 *
 * Staff = teachers, head teachers, school admins. Parents and students are
 * elsewhere. This service handles listing them and inviting new ones via
 * the invite-user Edge Function.
 *
 * The Edge Function does the heavy lifting (auth user creation, profile
 * upsert, idempotency by email). This service is a thin client wrapper.
 */

import { supabase } from '@/lib/supabase';
import { logAuditEvent } from './auditService';

const STAFF_ROLES = ['teacher', 'head_teacher', 'school_admin'];

/**
 * List staff at a school. Optionally filter by role.
 */
export async function listStaff({ schoolId, role = null } = {}) {
  let query = supabase
    .from('profiles')
    .select('user_id, full_name, email, role, school_id, created_at')
    .eq('school_id', schoolId)
    .in('role', role ? [role] : STAFF_ROLES)
    .order('full_name');
  const { data, error } = await query;
  if (error) throw new Error(`Could not load staff: ${error.message}`);
  return data ?? [];
}

/**
 * Invite a new staff member. Two modes:
 *   mode: 'invite'   — Supabase sends a magic-link email
 *   mode: 'password' — admin sets a temp password inline
 *
 * Returns { user_id, was_existing, temporary_password? }.
 * If was_existing is true, the email matched an existing user; the
 * profile was updated/linked rather than a fresh account created.
 */
export async function inviteStaff({ mode, email, fullName, role, schoolId, temporaryPassword }) {
  if (!STAFF_ROLES.includes(role)) {
    throw new Error(`Invalid staff role: ${role}`);
  }
  const { data, error } = await supabase.functions.invoke('invite-user', {
    body: {
      mode,
      email,
      full_name: fullName,
      role,
      school_id: schoolId,
      temporary_password: temporaryPassword,
    },
  });
  if (error) throw new Error(`Could not invite: ${error.message}`);
  // The edge function returns { error, detail } in the body on failures
  // that aren't HTTP errors — surface those too.
  if (data?.error) {
    throw new Error(humanizeError(data.error, data.detail));
  }
  logAuditEvent({
    action: 'staff.invited',
    targetUserId: data.user_id,
    targetSchoolId: schoolId,
    details: { role, mode, was_existing: data.was_existing },
  });
  return data;
}

/**
 * Invite a parent and link them to a pupil.
 * Same edge function, role='parent' + link_pupil_id.
 */
export async function inviteParentForPupil({ mode, email, fullName, pupilId, schoolId, temporaryPassword }) {
  const { data, error } = await supabase.functions.invoke('invite-user', {
    body: {
      mode,
      email,
      full_name: fullName,
      role: 'parent',
      school_id: schoolId,
      link_pupil_id: pupilId,
      temporary_password: temporaryPassword,
    },
  });
  if (error) throw new Error(`Could not invite parent: ${error.message}`);
  if (data?.error) {
    throw new Error(humanizeError(data.error, data.detail));
  }
  return data;
}

function humanizeError(code, detail) {
  switch (code) {
    case 'missing_fields': return 'Name and email are both required.';
    case 'insufficient_permissions': return "Your role doesn't allow inviting users at this level.";
    case 'cross_school_invite_blocked': return "You can only invite people to your own school.";
    case 'password_too_short': return 'Temporary password must be at least 8 characters.';
    case 'invite_failed': return `Could not send invite: ${detail ?? 'unknown error'}`;
    case 'create_failed': return `Could not create account: ${detail ?? 'unknown error'}`;
    case 'profile_upsert_failed': return `Account created but profile failed: ${detail ?? 'unknown error'}`;
    case 'linking_failed': return `Account created but linking failed: ${detail ?? 'unknown error'}`;
    default: return `${code}${detail ? ': ' + detail : ''}`;
  }
}

// ---- Class assignments (many-to-many via class_teachers) ------------------

/**
 * Which classes is this teacher currently assigned to?
 * Used by the staff edit panel to show + edit assignments.
 */
export async function getTeacherClasses(teacherId) {
  const { data, error } = await supabase
    .from('class_teachers')
    .select('class_id, subject, classes(id, name, level)')
    .eq('teacher_id', teacherId);
  if (error) throw new Error(`Could not load classes: ${error.message}`);
  return data ?? [];
}

/**
 * Set a teacher's class assignments. `classIds` is the FULL desired set
 * — we replace what's there, not append. Subject scoping is null for now
 * (the staff form doesn't expose subject-level assignment in v1).
 *
 * Done as: delete all current rows, then insert the new ones. Two queries,
 * but the operation is rare (admin re-assigning) and the data tiny.
 */
export async function setTeacherClasses({ teacherId, classIds }) {
  // Delete existing assignments for this teacher
  const { error: delErr } = await supabase
    .from('class_teachers')
    .delete()
    .eq('teacher_id', teacherId);
  if (delErr) throw new Error(`Could not clear assignments: ${delErr.message}`);

  if (classIds.length === 0) {
    logAuditEvent({
      action: 'teacher.classes_updated',
      targetUserId: teacherId,
      details: { class_count: 0 },
    });
    return [];
  }

  const rows = classIds.map((classId) => ({
    teacher_id: teacherId,
    class_id: classId,
    subject: null,
  }));
  const { data, error } = await supabase
    .from('class_teachers')
    .insert(rows)
    .select();
  if (error) throw new Error(`Could not save assignments: ${error.message}`);

  logAuditEvent({
    action: 'teacher.classes_updated',
    targetUserId: teacherId,
    details: { class_count: classIds.length, class_ids: classIds },
  });
  return data;
}
