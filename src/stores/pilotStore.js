/**
 * src/stores/pilotStore.js
 *
 * Zustand store for Pilot Mode state.
 * Hydrated at boot from the platform_settings table (via platformService).
 * SuperAdmin can toggle it live; the change is persisted to Supabase.
 */

import { create } from 'zustand';

export const usePilotStore = create((set) => ({
  /** null = loading, true/false = known value */
  pilotMode: null,
  isLoading: true,

  setPilotMode: (value) => set({ pilotMode: value, isLoading: false }),
  setLoading: () => set({ isLoading: true }),
}));

/** Convenience selector — returns true while value is unknown */
export const selectPilotLoading = (s) => s.isLoading;

/** Convenience selector — safe boolean (null → false) */
export const selectPilotMode = (s) => Boolean(s.pilotMode);
