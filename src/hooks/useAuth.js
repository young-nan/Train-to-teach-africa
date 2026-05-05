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

    // 1) Bootstrap with the existing session (if any)
    authService.getSession().then(async (session) => {
      if (cancelled) return;
      setSession(session);
      if (session?.user?.id) {
        try {
          const profile = await authService.hydrateProfile(session.user.id);
          if (!cancelled) setProfile(profile);
        } catch (e) {
          // Profile hydration failure is recoverable — user can retry login.
          console.error('[auth] profile hydration failed', e);
          reset();
        }
      }
    });

    // 2) Subscribe to auth state changes (login from another tab, refresh, etc.)
    const unsubscribe = authService.onAuthStateChange(async (session) => {
      if (cancelled) return;
      setSession(session);
      if (session?.user?.id) {
        try {
          const profile = await authService.hydrateProfile(session.user.id);
          if (!cancelled) setProfile(profile);
        } catch (e) {
          console.error('[auth] profile hydration failed', e);
        }
      } else {
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
