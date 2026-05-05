/**
 * src/config/roles.js
 *
 * THE single source of truth for user roles. Mirrored in:
 *   - Supabase enum `user_role` (see migrations)
 *   - RLS policies
 *   - Route guards
 *   - The role-adaptive lesson engine
 *
 * Adding a role means: add it here, add it to the migration enum, add a
 * RLS policy, add a route guard. Never invent a role inline.
 */

export const ROLES = Object.freeze({
  SUPER_ADMIN: 'super_admin',
  SCHOOL_ADMIN: 'school_admin',
  HEAD_TEACHER: 'head_teacher',
  TEACHER: 'teacher',
  PARENT: 'parent',
  STUDENT: 'student',
});

/**
 * Coarse capability checks. Use these in route guards and conditional UI.
 * Keep this list short — anything granular belongs in RLS, not here.
 */
export const CAPABILITIES = Object.freeze({
  canManageSchool: [ROLES.SUPER_ADMIN, ROLES.SCHOOL_ADMIN],
  canManageStaff: [ROLES.SUPER_ADMIN, ROLES.SCHOOL_ADMIN, ROLES.HEAD_TEACHER],
  canMarkAttendance: [ROLES.SUPER_ADMIN, ROLES.SCHOOL_ADMIN, ROLES.HEAD_TEACHER, ROLES.TEACHER],
  canEnterScores: [ROLES.SUPER_ADMIN, ROLES.SCHOOL_ADMIN, ROLES.HEAD_TEACHER, ROLES.TEACHER],
  canViewParentDashboard: [ROLES.PARENT],
  canViewStudentApp: [ROLES.STUDENT],
  canViewBilling: [ROLES.SUPER_ADMIN, ROLES.SCHOOL_ADMIN, ROLES.PARENT],
});

export function hasCapability(role, capability) {
  const allowed = CAPABILITIES[capability];
  return Array.isArray(allowed) && allowed.includes(role);
}

/**
 * Where each role lands after login. Centralised so the redirect rule is
 * never duplicated across login, signup, and post-payment flows.
 */
export const ROLE_HOME = Object.freeze({
  [ROLES.SUPER_ADMIN]: '/app/admin',
  [ROLES.SCHOOL_ADMIN]: '/app/admin',
  [ROLES.HEAD_TEACHER]: '/app/teacher',
  [ROLES.TEACHER]: '/app/teacher',
  [ROLES.PARENT]: '/app/parent',
  [ROLES.STUDENT]: '/app/student',
});
