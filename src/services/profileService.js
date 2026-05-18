/**
 * src/services/profileService.js
 *
 * Profile mutations for the authenticated user.
 * Separate from authService to avoid circular imports — authService imports
 * supabase directly; this module does too.
 *
 * WHAT THIS COVERS
 * ─────────────────
 *   updateProfile   — writes full_name + phone to the profiles table,
 *                     then re-reads current_user_profile so the caller
 *                     can push fresh state to the auth store.
 *
 *   changePassword  — calls supabase.auth.updateUser({ password }) which
 *                     updates the auth.users row. No old-password check
 *                     required — the user is already authenticated via
 *                     a valid session.
 *
 * HOW THE STORE UPDATE WORKS
 * ──────────────────────────
 * AccountSettingsPage calls updateProfile(), gets back the fresh profile,
 * then calls useAuthStore.getState().setProfile(updated). This updates
 * the name in the AppShell header without a page reload.
 */

import { supabase } from '@/lib/supabase';

/**
 * Patch the caller's profile row (full_name and/or phone).
 * Returns the updated current_user_profile row so the caller can
 * push it to useAuthStore.setProfile().
 *
 * @param {{ fullName?: string, phone?: string }} patch
 * @returns {Promise<object|null>} updated profile, or null if nothing changed
 */
export async function updateProfile({ fullName, phone } = {}) {
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) throw new Error('Not authenticated.');

  const updates = { updated_at: new Date().toISOString() };
  if (fullName !== undefined) updates.full_name = fullName.trim();
  if (phone    !== undefined) updates.phone     = phone?.trim() || null;

  // Always write updated_at even if only one field changed
  const { error: writeErr } = await supabase
    .from('profiles')
    .update(updates)
    .eq('user_id', user.id);

  if (writeErr) throw new Error(`Could not update profile: ${writeErr.message}`);

  // Re-read current_user_profile (includes school_name, child_ids, etc.)
  const { data: fresh, error: readErr } = await supabase
    .from('current_user_profile')
    .select('*')
    .single();

  if (readErr) throw new Error(`Could not reload profile: ${readErr.message}`);
  return fresh;
}

/**
 * Change the authenticated user's password.
 * The user must have an active session (enforced by Supabase).
 *
 * @param {string} newPassword — at least 8 characters
 */
export async function changePassword(newPassword) {
  if (!newPassword || newPassword.length < 8) {
    throw new Error('Password must be at least 8 characters.');
  }
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(`Could not update password: ${error.message}`);
}
