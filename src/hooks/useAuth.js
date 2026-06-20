/**
 * src/hooks/useAuth.js
 *
 * The ONLY auth hook in the codebase. Components import from here for:
 *   - Reading auth state (status, role, profile, schoolId)
 *   - Triggering auth actions (signIn, signOut)
 *   - Capability checks
 *
 * The hook orchestrates: authStore (state) + authService (Supabase IO).
 * Components never see Supabase or the store directly.
 */

import { useEffect, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';
import * as authService from '@/services/authService';
import { hasCapability } from '@/config/roles';

/**
 * Boot the auth lifecycle. Mount this exactly once at the app root —
 * AuthProvider does this for us; no other component should call
 * useAuthBootstrap directly.
 */
export function useAuthBootstrap() {
  const setSession = useAuthStore((s) => s.setSession);
  const setProfile = useAuthStore((s) => s.setProfile);
  const setLoading = useAuthStore((s) => s.setLoading);
  const reset = useAuthStore((s) => s.reset);

  useEffect(() => {
    let cancelled = false;
    setLoading();

    // De-dupe profile hydration. Without this, the bootstrap and the
    // onAuthStateChange listener BOTH fire with the same session on first
    // load — causing two profile fetches per page load. We track the last
    // user_id we hydrated for and skip if it matches.
    let lastHydratedUserId = null;

    const hydrateIfNeeded = async (session) => {
      const uid = session?.user?.id;
      if (!uid) return;
      if (uid === lastHydratedUserId) return; // already done
      lastHydratedUserId = uid;
      try {
        const profile = await authService.hydrateProfile(uid);
        if (!cancelled) setProfile(profile);
      } catch (e) {
        console.error('[auth] profile hydration failed', e);
        // Reset the marker so a retry (e.g. via auth state change) can try again.
        lastHydratedUserId = null;
      }
    };

    // 1) Bootstrap with the existing session (if any)
    authService.getSession().then(async (session) => {
      if (cancelled) return;
      setSession(session);
      await hydrateIfNeeded(session);
    });

    // 2) Subscribe to auth state changes (login from another tab, refresh, etc.)
    const unsubscribe = authService.onAuthStateChange(async (session) => {
      if (cancelled) return;
      setSession(session);
      if (session?.user?.id) {
        await hydrateIfNeeded(session);
      } else {
        lastHydratedUserId = null;
        reset();
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [setSession, setProfile, setLoading, reset]);
}

/**
 * Read-only auth surface for components.
 * Selectors are explicit so React only re-renders when the right slice changes.
 */
export function useAuth() {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const role = useAuthStore((s) => s.role);
  const schoolId = useAuthStore((s) => s.schoolId);
  const schoolName = useAuthStore((s) => s.schoolName);
  const childIds = useAuthStore((s) => s.childIds);

  const signIn = useCallback(
    async (creds) => authService.signInWithPassword(creds),
    [],
  );
  const signUp = useCallback(
    async (input) => authService.signUp(input),
    [],
  );
  const studentPinSignIn = useCallback(
    async (input) => authService.signInWithStudentPin(input),
    [],
  );
  const signOut = useCallback(async () => authService.signOut(), []);
  const requestPasswordReset = useCallback(
    async (email) => authService.requestPasswordReset(email),
    [],
  );
  const can = useCallback((capability) => hasCapability(role, capability), [role]);

  return {
    status,
    isLoading: status === 'loading',
    isAuthenticated: status === 'authenticated',
    user,
    profile,
    role,
    schoolId,
    schoolName,
    childIds,
    signIn,
    signUp,
    studentPinSignIn,
    signOut,
    requestPasswordReset,
    can,
  };
}
