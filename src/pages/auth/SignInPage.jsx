/**
 * src/pages/auth/SignInPage.jsx
 *
 * Email + password sign-in. Students go to /student-sign-in (PIN only).
 *
 * Post-sign-in flow: we wait for the auth store's `role` to populate
 * before navigating, so the destination is role-aware. Without this
 * wait, navigate() fires before profile hydration completes and the
 * user lands on `/` (the public homepage) instead of their dashboard.
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { ROLE_HOME } from '@/config/roles';

export default function SignInPage() {
  const { signIn, role, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [error, setError] = useState(null);

  // After the auth call resolves, we set `signedIn`. We then watch the
  // `role` value — once it lands (auth bootstrap finished hydrating the
  // profile), we navigate. If the user came from a protected route
  // (`?next=...`), prefer that; otherwise route by role.
  useEffect(() => {
    if (!signedIn) return;
    if (!isAuthenticated || !role) return; // still hydrating
    const dest = next ? decodeURIComponent(next) : (ROLE_HOME[role] ?? '/');
    navigate(dest, { replace: true });
  }, [signedIn, isAuthenticated, role, next, navigate]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn({ email, password });
      // Don't navigate yet — wait for role hydration in the effect above.
      setSignedIn(true);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back."
      subtitle="Sign in to your account."
      footer={
        <div className="space-y-s-3">
          <div>
            New here? <Link to="/sign-up" className="text-gold-200 hover:text-gold-50">Create an account</Link>
          </div>
          <div>
            Are you a student? <Link to="/student-sign-in" className="text-gold-200 hover:text-gold-50">Use your PIN</Link>
          </div>
        </div>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-s-5" noValidate>
        <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" required />
        <Field label="Password" type="password" value={password} onChange={setPassword} autoComplete="current-password" required />
        {error && <div className="text-[13px] text-red-400 bg-red-400/10 border border-red-400/30 rounded-r-2 px-s-4 py-s-3">{error}</div>}
        <Button intent="primary" size="lg" type="submit" isLoading={submitting} className="w-full justify-center">
          Sign in
        </Button>
        <Link to="/auth/reset" className="text-[13px] text-ink-3 hover:text-ink-1 text-center">Forgot your password?</Link>
      </form>
    </AuthLayout>
  );
}

function Field({ label, type, value, onChange, ...rest }) {
  return (
    <label className="flex flex-col gap-s-2">
      <span className="font-mono text-meta uppercase tracking-[0.14em] text-ink-3">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-surface-2 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[15px] text-ink-0 outline-none focus:border-gold-400 transition-colors duration-150"
        {...rest}
      />
    </label>
  );
}
