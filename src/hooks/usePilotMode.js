/**
 * src/hooks/usePilotMode.js
 *
 * The ONLY hook components should use to read or set pilot mode.
 *
 * READING  → const { pilotMode, isLoading } = usePilotMode();
 * WRITING  → const { togglePilotMode } = usePilotMode(); // super_admin only
 *
 * The toggle call persists to Supabase (platform_settings table) and
 * optimistically updates the local store. On error it rolls back.
 */

import { useCallback } from 'react';
import { usePilotStore } from '@/stores/pilotStore';
import { setPilotModeSetting } from '@/services/platformService';
import { PILOT_MODE_ENV_OVERRIDE } from '@/config/pilotMode';
import { useAuth } from '@/hooks/useAuth';

export function usePilotMode() {
  const { role } = useAuth();
  const { pilotMode, isLoading, setPilotMode } = usePilotStore();

  // Env override wins — used in local dev / staging without a DB write.
  const effective = PILOT_MODE_ENV_OVERRIDE ? true : Boolean(pilotMode);

  const togglePilotMode = useCallback(
    async (value) => {
      if (role !== 'super_admin') {
        console.warn('[pilotMode] toggle called by non-super_admin — ignored');
        return;
      }
      // Optimistic update
      const previous = pilotMode;
      setPilotMode(value);

      try {
        await setPilotModeSetting(value);
      } catch (err) {
        console.error('[pilotMode] persist failed — rolling back', err);
        setPilotMode(previous);
      }
    },
    [role, pilotMode, setPilotMode],
  );

  return {
    pilotMode: effective,
    isLoading,
    togglePilotMode,
    canToggle: role === 'super_admin',
  };
}
