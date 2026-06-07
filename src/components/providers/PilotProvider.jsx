/**
 * src/components/providers/PilotProvider.jsx
 *
 * Hydrates the pilot mode store from Supabase at boot.
 * Must be rendered INSIDE AuthProvider (it uses the auth context to
 * know when the user is authenticated before reading the setting).
 *
 * PLACEMENT IN TREE
 * ──────────────────
 *   <AuthProvider>
 *     <PilotProvider>       ← here, after auth resolves
 *       <RouterProvider />
 *     </PilotProvider>
 *   </AuthProvider>
 *
 * BEHAVIOUR
 * ──────────
 *   - While loading: pilotMode = null, isLoading = true
 *     → PilotBanner renders nothing, PilotGate uses fallback
 *   - On success: pilotMode = true/false, isLoading = false
 *   - On error: logs and defaults to false (fail-closed, not fail-open)
 *
 * LOCAL ENV OVERRIDE
 * ───────────────────
 *   VITE_PILOT_MODE=true in .env.local bypasses the DB call entirely.
 *   The store is set immediately and no network request is made.
 *   Safe to use in staging, never in production.
 */

import { useEffect } from 'react';
import { usePilotStore } from '@/stores/pilotStore';
import { getPilotMode } from '@/services/platformService';
import { PILOT_MODE_ENV_OVERRIDE } from '@/config/pilotMode';
import { useAuth } from '@/hooks/useAuth';

export function PilotProvider({ children }) {
  const { status } = useAuth();          // 'loading' | 'authenticated' | 'unauthenticated'
  const { setPilotMode, setLoading } = usePilotStore();

  useEffect(() => {
    // Only run once auth has resolved — avoids racing the session hydration.
    if (status === 'loading') return;

    // Local dev override — set immediately, skip DB call.
    if (PILOT_MODE_ENV_OVERRIDE) {
      setPilotMode(true);
      return;
    }

    // Unauthenticated users don't need pilot mode — default to false.
    if (status === 'unauthenticated') {
      setPilotMode(false);
      return;
    }

    // Authenticated: read from Supabase.
    setLoading();
    getPilotMode()
      .then((value) => setPilotMode(value))
      .catch((err) => {
        console.error('[PilotProvider] could not read pilot_mode — defaulting to false', err);
        setPilotMode(false);  // Fail-closed: no free access on error
      });
  }, [status, setPilotMode, setLoading]);

  return children;
}
