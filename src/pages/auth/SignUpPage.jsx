/**
 * src/pages/auth/SignUpPage.jsx
 *
 * Account creation. Defaults to parent role (most volume); schools onboard
 * via a sales-led flow that lands here too but pre-selects 'school_admin'.
 */

import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { useAuth } from '@/hooks/useAuth';

const ROLE_OPTIONS = [
  { value: 'parent', label: 'Parent', body: 'Sign up to support your child\'s learning at home.' },
  { value: 'teacher', label: 'Teacher', body: 'Use the lesson library and CPD content.' },
];

export default function SignUpPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialPlan = params.get('plan');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('parent');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signUp({ email, password, fullName, role });
      // Pre-selected plan: route into checkout. Otherwise into the app.
      if (initialPlan) navigate(`/billing/checkout?plan=${initialPlan}`);
      else navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

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
