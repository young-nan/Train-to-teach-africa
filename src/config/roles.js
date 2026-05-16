/**
 * src/config/roles.js
 *
 * THE single source of truth for user roles.
 *
 * Changes from previous version:
 *   - Added ROLES.TUTOR ('tutor') — added to DB enum in migration 0005
 *   - ROLE_HOME: super_admin now lands at /app/super (not /app/admin)
 *   - ROLE_HOME: head_teacher lands at /app/teacher (class-level first)
 *   - CAPABILITIES: added canManagePlatform, canUseTutorDashboard
 */

export const ROLES = Object.freeze({
  SUPER_ADMIN:  'super_admin',
  SCHOOL_ADMIN: 'school_admin',
  HEAD_TEACHER: 'head_teacher',
  TEACHER:      'teacher',
  PARENT:       'parent',
  STUDENT:      'student',
  TUTOR:        'tutor',   // ← added: marketplace tutors
});

/**
 * Coarse capability checks. Use these in route guards and conditional UI.
 * Anything granular belongs in RLS policies, not here.
 */
export const CAPABILITIES = Object.freeze({
  // Platform-wide (super admin only)
  canManagePlatform: [ROLES.SUPER_ADMIN],

  // School management
  canManageSchool: [ROLES.SUPER_ADMIN, ROLES.SCHOOL_ADMIN],

  // Staff management
  canManageStaff: [ROLES.SUPER_ADMIN, ROLES.SCHOOL_ADMIN, ROLES.HEAD_TEACHER],

  // Classroom operations
  canMarkAttendance: [ROLES.SUPER_ADMIN, ROLES.SCHOOL_ADMIN, ROLES.HEAD_TEACHER, ROLES.TEACHER],
  canEnterScores:    [ROLES.SUPER_ADMIN, ROLES.SCHOOL_ADMIN, ROLES.HEAD_TEACHER, ROLES.TEACHER],
  canWriteReports:   [ROLES.SUPER_ADMIN, ROLES.SCHOOL_ADMIN, ROLES.HEAD_TEACHER, ROLES.TEACHER],

  // Parent and student
  canViewParentDashboard: [ROLES.PARENT],
  canViewStudentApp:      [ROLES.STUDENT],

  // Tutor marketplace
  canUseTutorDashboard: [ROLES.TUTOR, ROLES.SUPER_ADMIN],

  // Billing
  canViewSchoolBilling:  [ROLES.SUPER_ADMIN, ROLES.SCHOOL_ADMIN],
  canViewParentBilling:  [ROLES.PARENT],
  canViewPlatformRevenue:[ROLES.SUPER_ADMIN],
});

export function hasCapability(role, capability) {
  const allowed = CAPABILITIES[capability];
  return Array.isArray(allowed) && allowed.includes(role);
}

/**
 * Where each role lands after login.
 *
 * super_admin  → /app/super  (platform overview — NOT school overview)
 * school_admin → /app/admin  (school overview)
 * head_teacher → /app/teacher (their daily class view; admin at /app/admin)
 * teacher      → /app/teacher
 * parent       → /app/parent
 * student      → /app/student
 * tutor        → /app/tutor
 */
export const ROLE_HOME = Object.freeze({
  [ROLES.SUPER_ADMIN]:  '/app/super',    // ← was /app/admin, now /app/super
  [ROLES.SCHOOL_ADMIN]: '/app/admin',
  [ROLES.HEAD_TEACHER]: '/app/teacher',  // ← was /app/admin
  [ROLES.TEACHER]:      '/app/teacher',
  [ROLES.PARENT]:       '/app/parent',
  [ROLES.STUDENT]:      '/app/student',
  [ROLES.TUTOR]:        '/app/tutor',    // ← new
});
