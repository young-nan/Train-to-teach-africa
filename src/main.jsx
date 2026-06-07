/**
 * src/main.jsx
 *
 * App entry. Boots:
 *   1. React Query (server cache)
 *   2. Auth lifecycle (session + profile hydration)
 *   3. Pilot Mode hydration  ← NEW in v2
 *   4. Offline sync engine
 *   5. Router
 *
 * v2 CHANGE: PilotProvider added between AuthProvider and Routes.
 * PilotProvider reads the pilot_mode setting from Supabase once auth
 * resolves, then stores it in Zustand. All components that need to check
 * pilot mode use usePilotMode() — they never query Supabase directly.
 *
 * The provider is placed AFTER auth resolves so it can check the session
 * before making the DB call. It has zero performance impact when pilot mode
 * is off — it reads one row from platform_settings and returns.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Routes } from '@/routes';
import { useAuthBootstrap } from '@/hooks/useAuth';
import { PilotProvider } from '@/components/providers/PilotProvider';
import { startSyncEngine } from '@/lib/offline/sync';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: (failureCount, error) => {
        // Don't retry auth errors — they won't get better.
        if (error?.code === 401 || error?.code === 403) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false, // schools have flaky connections; don't thrash
    },
  },
});

function AuthProvider({ children }) {
  useAuthBootstrap();
  return children;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {/*
          PilotProvider sits here — inside AuthProvider so it can read
          auth.status, outside Routes so it runs before any route renders.
          This means every page in the app always has pilotMode in the store
          before it mounts.
        */}
        <PilotProvider>
          <Routes />
        </PilotProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

// Start the offline sync engine — must happen once at boot.
startSyncEngine();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
