/**
 * src/main.jsx
 *
 * App entry. Boots:
 *   1. React Query (server cache)
 *   2. Auth lifecycle (session + profile hydration)
 *   3. Offline sync engine
 *   4. Router
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Routes } from '@/routes';
import { useAuthBootstrap } from '@/hooks/useAuth';
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
        <Routes />
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
