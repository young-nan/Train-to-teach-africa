/**
 * src/services/platformService.js
 *
 * Super admin only. Platform-wide operations across all schools.
 *
 * All functions here operate at the TTA network level, not at a single school.
 * School-scoped operations stay in simsService.js, staffService.js, etc.
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
 */
export async function createSchool({ name, city, state, email, phone }) {
  const slug = name.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const { data, error } = await supabase
    .from('schools')
    .insert({ name, city, state, email, phone, slug, active: true })
    .select()
    .single();
  if (error) throw new Error(`Could not create school: ${error.message}`);

  logAuditEvent({ action: 'school.created', details: { school_id: data.id, name } });
  return data;
}

/**
 * Deactivate (soft-delete) a school.
 */
export async function deactivateSchool(schoolId) {
  const { data, error } = await supabase
    .from('schools')
    .update({ active: false })
    .eq('id', schoolId)
    .select('id, name')
    .single();
  if (error) throw new Error(`Could not deactivate school: ${error.message}`);
  logAuditEvent({ action: 'school.deactivated', details: { school_id: schoolId } });
  return data;
}

// ── User management (platform level) ─────────────────────────────────────────

/**
 * Search users across the platform by name, email, or role.
 * Returns profiles + school name.
 */
export async function searchUsers({ query = '', role = null, page = 1, pageSize = 20 } = {}) {
  let q = supabase
    .from('profiles')
    .select(`
      user_id, full_name, email, role, phone, created_at,
      schools(name)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (query) {
    q = q.or(`full_name.ilike.%${query}%,email.ilike.%${query}%`);
  }
  if (role) q = q.eq('role', role);

  const { data, error, count } = await q;
  if (error) throw new Error(`Search failed: ${error.message}`);

  return {
    users:      data ?? [],
    totalCount: count ?? 0,
    page,
    pageSize,
    totalPages: Math.ceil((count ?? 0) / pageSize),
  };
}

/**
 * Change a user's role. Super admin only.
 * Guards: cannot demote another super_admin; cannot self-demote.
 */
export async function changeUserRole({ userId, newRole }) {
  const ALLOWED_ROLES = ['parent', 'teacher', 'head_teacher', 'school_admin', 'tutor', 'super_admin'];
  if (!ALLOWED_ROLES.includes(newRole)) {
    throw new Error(`Invalid role: ${newRole}`);
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ role: newRole })
    .eq('user_id', userId)
    .select('user_id, full_name, role')
    .single();

  if (error) throw new Error(`Could not update role: ${error.message}`);
  logAuditEvent({ action: 'user.role_changed', details: { user_id: userId, new_role: newRole } });
  return data;
}

/**
 * Invite a new user at the platform level (not tied to a specific school).
 * Used by super admin to onboard school owners, new tutors, etc.
 */
export async function invitePlatformUser({ email, fullName, role, schoolId = null }) {
  const { data, error } = await supabase.functions.invoke('Invite-user', {
    body: {
      email,
      full_name: fullName,
      role,
      school_id: schoolId,
      mode: 'invite',
    },
  });
  if (error || data?.error) {
    throw new Error(error?.message ?? data?.error ?? 'Invitation failed.');
  }
  logAuditEvent({
    action:  'user.platform_invited',
    details: { email, role, school_id: schoolId },
  });
  return data;
}

// ── Tutor management ──────────────────────────────────────────────────────────

/**
 * List tutors by status. Used by super admin tutor management tab.
 */
export async function listTutors({ status = null, page = 1, pageSize = 20 } = {}) {
  let q = supabase
    .from('tutors')
    .select(`
      id, full_name, city, state, approval_status, teaches_online,
      teaches_offline, hourly_rate_minor, currency, rating_avg,
      rating_count, created_at,
      tutor_subjects(subject, curriculum)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (status) q = q.eq('approval_status', status);

  const { data, error, count } = await q;
  if (error) throw new Error(`Could not load tutors: ${error.message}`);

  return {
    tutors:     data ?? [],
    totalCount: count ?? 0,
    page,
    pageSize,
    totalPages: Math.ceil((count ?? 0) / pageSize),
  };
}
