/**
 * src/pages/auth/SignUpPage.jsx
 *
 * Account creation. Defaults to parent role (most volume); schools onboard
 * via a sales-led flow that lands here too but pre-selects 'school_admin'.
 *
 * Two post-signup paths:
 *  1. Email confirmation disabled (dev / Supabase setting off):
 *     session is returned immediately → wait for profile hydration → redirect.
 *  2. Email confirmation enabled (production default):
 *     session is null → show "check your email" screen. User clicks the
 *     link in the email, lands back on the app, session is established,
 *     and the auth bootstrap redirects them from the sign-in flow.
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { useAuth } from '@/hooks/useAuth';
import { ROLE_HOME } from '@/config/roles';

const ROLE_OPTIONS = [
  { value: 'parent', label: 'Parent', body: 'Sign up to support your child\'s learning at home.' },
  { value: 'teacher', label: 'Teacher', body: 'Use the lesson library and CPD content.' },
];

export default function SignUpPage() {
  // Alias the store's role to `userRole` — the form uses `role` for the
  // chosen-on-signup value, which is different from the hydrated role.
  const { signUp, role: userRole, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialPlan = params.get('plan');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('parent');
  const [submitting, setSubmitting] = useState(false);
  // 'idle' | 'awaiting_hydration' | 'confirm_email'
  const [signupState, setSignupState] = useState('idle');
  const [error, setError] = useState(null);

  // Path 1: session returned immediately — wait for profile to hydrate then redirect.
  useEffect(() => {
    if (signupState !== 'awaiting_hydration') return;
    if (!isAuthenticated || !userRole) return;
    if (initialPlan) {
      navigate(`/billing/checkout?plan=${initialPlan}`, { replace: true });
    } else {
      navigate(ROLE_HOME[userRole] ?? '/', { replace: true });
    }
  }, [signupState, isAuthenticated, userRole, initialPlan, navigate]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { confirmationRequired } = await signUp({ email, password, fullName, role });
      if (confirmationRequired) {
        // Production path: Supabase sent a confirmation email.
        // Show the check-email screen — no spinner, no hang.
        setSignupState('confirm_email');
        setSubmitting(false);
      } else {
        // Dev / confirmation-off path: session is live immediately.
        // Keep the button spinning while auth store hydrates.
        setSignupState('awaiting_hydration');
      }
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  // ── Check-email confirmation screen ─────────────────────────────────────────
  if (signupState === 'confirm_email') {
    return (
      <AuthLayout
        title="Check your email."
        subtitle="We've sent a confirmation link to get you started."
      >
        <div className="flex flex-col gap-s-5">
          <div className="bg-surface-2 border border-line-2 rounded-r-2 px-s-5 py-s-5 text-center">
            <div className="text-[32px] mb-s-3">✉️</div>
            <p className="text-[15px] text-ink-1 mb-s-2">
              We sent a link to <span className="text-ink-0 font-medium">{email}</span>.
            </p>
            <p className="text-[13px] text-ink-3">
              Click the link in the email to activate your account. Check your spam folder if you
              don't see it within a minute.
            </p>
          </div>
          <p className="text-[13px] text-ink-3 text-center">
            Wrong email?{' '}
            <button
              type="button"
              onClick={() => setSignupState('idle')}
              className="text-gold-200 hover:text-gold-50 underline"
            >
              Go back and try again.
            </button>
          </p>
          <div className="text-center">
            <Link to="/sign-in" className="text-[13px] text-ink-3 hover:text-ink-1">
              Already confirmed? Sign in →
            </Link>
          </div>
        </div>
      </AuthLayout>
    );
  }

  // ── Sign-up form ─────────────────────────────────────────────────────────────
  return (
    <AuthLayout
      title="Create your account."
      subtitle="Free to start. Upgrade when you're ready."
      footer={<>Already have an account? <Link to="/sign-in" className="text-gold-200 hover:text-gold-50">Sign in</Link></>}
    >
      {initialPlan && (
        <div className="mb-s-5">
          <Chip variant="gold" dot>Plan selected · {initialPlan.replace(/_/g, ' ').toLowerCase()}</Chip>
        </div>
      )}
      <form onSubmit={onSubmit} className="flex flex-col gap-s-5" noValidate>
        <Field label="Full name" type="text" value={fullName} onChange={setFullName} autoComplete="name" required />
        <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" required />
        <Field label="Password" type="password" value={password} onChange={setPassword} autoComplete="new-password" required minLength={8} />

        <fieldset>
          <legend className="font-mono text-meta uppercase tracking-[0.14em] text-ink-3 mb-s-3">I am a</legend>
          <div className="grid grid-cols-2 gap-s-3">
            {ROLE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`bg-surface-2 border rounded-r-2 p-s-4 cursor-pointer transition-all duration-150 ${
                  role === opt.value ? 'border-gold-400/60 bg-surface-3' : 'border-line-2 hover:border-line-3'
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value={opt.value}
                  checked={role === opt.value}
                  onChange={() => setRole(opt.value)}
                  className="sr-only"
                />
                <div className="font-display text-[16px] text-ink-0">{opt.label}</div>
                <div className="mt-s-1 text-[12.5px] text-ink-2">{opt.body}</div>
              </label>
            ))}
          </div>
        </fieldset>

        {error && <div className="text-[13px] text-red-400 bg-red-400/10 border border-red-400/30 rounded-r-2 px-s-4 py-s-3">{error}</div>}

        <Button intent="primary" size="lg" type="submit" isLoading={submitting} className="w-full justify-center">
          Create account
        </Button>

        <p className="text-[12px] text-ink-3 text-center">
          By creating an account you agree to our terms and privacy policy.
        </p>
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
