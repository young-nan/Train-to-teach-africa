/**
 * src/routes/guards.jsx
 *
 * Route-level guards for authenticated and role-gated routes.
 *
 * Note: these guards are convenience UI gates — the real security boundary
 * is RLS in Postgres. A clever user CAN poke around the DOM; they cannot
 * read another role's data because RLS denies it server-side.
 */

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ROLE_HOME } from '@/config/roles';

/**
 * Requires an authenticated session. Sends unauthenticated users to /sign-in
 * preserving the intended destination as a `next` query param.
 */
export function RequireAuth({ children }) {
  const { status, role } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <BootSplash />;
  if (status === 'unauthenticated') {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/sign-in?next=${next}`} replace />;
  }
  // Authenticated but no role yet (profile still hydrating) — show splash.
  if (!role) return <BootSplash />;

  return children;
}

/**
 * Requires the authenticated user to have ONE of the allowed roles.
 * If they're authed with the wrong role, redirect to THEIR home.
 */
export function RequireRole({ allow, children }) {
  const { role, status } = useAuth();
  if (status === 'loading' || !role) return <BootSplash />;
  if (!allow.includes(role)) {
    return <Navigate to={ROLE_HOME[role] ?? '/'} replace />;
  }
  return children;
}

function BootSplash() {
  return (
    <div className="min-h-dvh grid place-items-center bg-surface-1 text-ink-3">
      <div className="font-mono text-meta tracking-[0.18em] uppercase">Loading</div>
    </div>
  );
}
