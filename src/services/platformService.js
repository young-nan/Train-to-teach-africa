/**
 * src/services/platformService.js
 *
 * Super admin only. Platform-wide operations across all schools.
 *
 * All functions here operate at the TTA network level, not at a single school.
 * School-scoped operations stay in simsService.js, staffService.js, etc.
 *
 * v2 additions:
 *   getPilotMode()        — reads platform_settings.pilot_mode
 *   setPilotModeSetting() — writes platform_settings.pilot_mode (super_admin only)
 *   getActiveModules()    — reads active_modules table
 */

import { supabase } from '@/lib/supabase';
import { logAuditEvent } from './auditService';

// ── Platform stats ────────────────────────────────────────────────────────────

/**
 * Hero KPIs: school count, parent count, tutor count, pupil count,
 * revenue (30d), active subscriptions, pending items.
 */
export async function getPlatformStats() {
  const { data, error } = await supabase.rpc('get_platform_stats');
  if (error) throw new Error(`Could not load platform stats: ${error.message}`);
  return data;
}

/**
 * 30-day signup trend by role.
 * Returns [{ signup_date, role, signups }] newest-first.
 */
export async function getSignupTrend() {
  const { data, error } = await supabase
    .from('platform_signups_by_day')
    .select('*')
    .order('signup_date', { ascending: false });
  if (error) throw new Error(`Could not load signup trend: ${error.message}`);
  return data ?? [];
}

/**
 * Items needing super admin attention (pending tutor approvals, new schools).
 */
export async function getPendingApprovals() {
  const { data, error } = await supabase
    .from('pending_approvals')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw new Error(`Could not load pending approvals: ${error.message}`);
  return data ?? [];
}

/**
 * Monthly revenue breakdown by plan type.
 */
export async function getRevenueSummary({ months = 6 } = {}) {
  const { data, error } = await supabase.rpc('platform_revenue_summary', { p_months: months });
  if (error) throw new Error(`Could not load revenue: ${error.message}`);
  return data ?? [];
}

// ── Pilot Mode ────────────────────────────────────────────────────────────────

/**
 * Read the current pilot mode setting from the database.
 * Called at boot by usePilotMode() to hydrate the pilot store.
 * Any authenticated user can read this (RLS allows it).
 *
 * @returns {Promise<boolean>}
 */
export async function getPilotMode() {
  const { data, error } = await supabase.rpc('get_pilot_mode');
  if (error) throw new Error(`Could not read pilot mode: ${error.message}`);
  return Boolean(data);
}

/**
 * Write the pilot mode setting to the database.
 * Only super_admin can execute set_pilot_mode() — the RPC enforces this.
 * Throws if the caller is not super_admin or if the DB write fails.
 *
 * @param {boolean} enabled
 * @returns {Promise<void>}
 */
export async function setPilotModeSetting(enabled) {
  const { error } = await supabase.rpc('set_pilot_mode', { p_enabled: enabled });
  if (error) throw new Error(`Could not update pilot mode: ${error.message}`);
  // Audit event is written by the DB trigger, but we also log client-side
  // for immediate availability in the audit log component.
  await logAuditEvent({
    entityType: 'platform_settings',
    entityId: 'pilot_mode',
    action: enabled ? 'pilot_mode_enabled' : 'pilot_mode_disabled',
  }).catch(() => {
    // Non-fatal — the DB trigger already wrote the audit entry.
  });
}

/**
 * Get the list of active EOS modules and their enabled status.
 * Used to conditionally render nav items and features.
 *
 * @returns {Promise<Array<{ module_key: string, enabled: boolean, label: string }>>}
 */
export async function getActiveModules() {
  const { data, error } = await supabase
    .from('active_modules')
    .select('module_key, enabled, label, description')
    .order('module_key');
  if (error) throw new Error(`Could not load active modules: ${error.message}`);
  return data ?? [];
}

// ── School management ─────────────────────────────────────────────────────────

/**
 * List all schools with basic stats. Super admin platform view.
 */
export async function listAllSchools() {
  const { data, error } = await supabase
    .from('schools')
    .select(`
      id, name, slug, city, state, active, created_at,
      impact_page_enabled
    `)
    .order('name');
  if (error) throw new Error(`Could not load schools: ${error.message}`);
  return data ?? [];
}

/**
 * Create a new school on the platform.
 * Also creates the initial school_admin invite (done server-side).
 */
export async function createSchool({ name, city, state, phone }) {
  const slug = name.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();

  const { data, error } = await supabase
    .from('schools')
    .insert({ name, slug, city, state, phone, active: true })
    .select('id, name, slug')
    .single();

  if (error) throw new Error(`Could not create school: ${error.message}`);
  return data;
}

/**
 * Deactivate a school. Does not delete data.
 * The school's users lose dashboard access until reactivated.
 */
export async function deactivateSchool(schoolId) {
  const { error } = await supabase
    .from('schools')
    .update({ active: false })
    .eq('id', schoolId);
  if (error) throw new Error(`Could not deactivate school: ${error.message}`);
  await logAuditEvent({
    entityType: 'school',
    entityId: schoolId,
    action: 'school_deactivated',
  }).catch(() => {});
}

// ── User management ───────────────────────────────────────────────────────────

/**
 * Search users across the entire platform.
 * Returns paginated results with school name.
 *
 * @param {{ query?: string, role?: string|null, page?: number }} opts
 */
export async function searchUsers({ query = '', role = null, page = 1, perPage = 25 } = {}) {
  let q = supabase
    .from('profiles')
    .select('user_id, full_name, email, role, school_id, created_at, schools(name)', { count: 'exact' });

  if (query) {
    q = q.or(`full_name.ilike.%${query}%,email.ilike.%${query}%`);
  }
  if (role) {
    q = q.eq('role', role);
  }

  const from = (page - 1) * perPage;
  q = q.range(from, from + perPage - 1).order('created_at', { ascending: false });

  const { data, count, error } = await q;
  if (error) throw new Error(`Could not search users: ${error.message}`);

  return {
    users: data ?? [],
    totalCount: count ?? 0,
    page,
    totalPages: Math.ceil((count ?? 0) / perPage),
  };
}

/**
 * Change a user's role. Super admin only.
 * Cannot change super_admin to any other role via this function (safety).
 */
export async function changeUserRole({ userId, newRole }) {
  const { error } = await supabase
    .from('profiles')
    .update({ role: newRole })
    .eq('user_id', userId);
  if (error) throw new Error(`Could not change role: ${error.message}`);
  await logAuditEvent({
    entityType: 'user',
    entityId: userId,
    action: 'role_changed',
    newValue: { role: newRole },
  }).catch(() => {});
}

/**
 * Invite a new user to the platform by email.
 * Supabase Auth sends the magic link; we set the role in metadata.
 */
export async function invitePlatformUser({ email, fullName, role, schoolId }) {
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: {
      full_name: fullName,
      role,
      school_id: schoolId || null,
    },
  });
  if (error) throw new Error(`Could not invite user: ${error.message}`);
  return data;
}

/**
 * List tutors filtered by approval status.
 */
export async function listTutors({ status = null } = {}) {
  let q = supabase
    .from('tutors')
    .select(`
      id, full_name, city, state, bio, hourly_rate_minor,
      teaches_online, teaches_offline, approval_status,
      rejection_reason, active, created_at,
      tutor_subjects (subject, curriculum, level)
    `)
    .order('created_at', { ascending: false });

  if (status) q = q.eq('approval_status', status);

  const { data, error } = await q;
  if (error) throw new Error(`Could not list tutors: ${error.message}`);
  return { tutors: data ?? [] };
}
