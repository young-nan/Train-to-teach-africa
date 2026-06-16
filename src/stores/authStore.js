/**
 * src/stores/authStore.js
 *
 * The single auth state. There is no "useUser", "useSession", "useRole" —
 * everything goes through this store, surfaced via the useAuth() hook.
 *
 * Why Zustand and not Context: schools have multi-second cold starts on
 * low-end Android. Zustand's selector-based subscription means a sidebar
 * re-render doesn't cascade into the lesson surface when only the toast
 * count changes. Context would.
 */

import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  // ---- State -------------------------------------------------------------
  status: 'loading',          // 'loading' | 'authenticated' | 'unauthenticated'
  session: null,              // Supabase session
  user: null,                 // auth.users row
  profile: null,              // app profile (full_name, avatar, etc.)
  role: null,                 // one of ROLES.*
  schoolId: null,             // for school-scoped users
  schoolName: null,
  childIds: [],               // for parents
  capabilities: [],           // resolved from role at hydration time

  // ---- Mutations (called by useAuth, not by components) ------------------
  setLoading: () => set({ status: 'loading' }),

  setSession: (session) => set({
    session,
    user: session?.user ?? null,
    status: session ? 'authenticated' : 'unauthenticated',
  }),

  setProfile: (profile) => set({
    profile,
    role: profile?.role ?? null,
    schoolId: profile?.school_id ?? null,
    schoolName: profile?.school_name ?? null,
    childIds: profile?.child_ids ?? [],
  }),

  reset: () => set({
    status: 'unauthenticated',
    session: null,
    user: null,
    profile: null,
    role: null,
    schoolId: null,
    schoolName: null,
    childIds: [],
    capabilities: [],
  }),
}));
