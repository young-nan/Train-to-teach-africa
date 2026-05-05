/**
 * src/pages/auth/ResetPasswordPage.jsx
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';

export default function ResetPasswordPage() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await requestPasswordReset(email);
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Reset your password."
      subtitle={done ? undefined : 'We\'ll email you a link.'}
      footer={<>Remembered it? <Link to="/sign-in" className="text-gold-200 hover:text-gold-50">Sign in</Link></>}
    >
      {done ? (
        <div className="bg-surface-2 border border-line-2 rounded-r-3 p-s-7 text-center">
          <div className="font-display text-display-3 text-ink-0">Check your inbox.</div>
          <p className="mt-s-3 text-body text-ink-2">If the email exists in our system, you'll have a link in a minute.</p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-s-5" noValidate>
          <label className="flex flex-col gap-s-2">
            <span className="font-mono text-meta uppercase tracking-[0.14em] text-ink-3">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              className="bg-surface-2 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[15px] text-ink-0 outline-none focus:border-gold-400"
            />
          </label>
          {error && <div className="text-[13px] text-red-400 bg-red-400/10 border border-red-400/30 rounded-r-2 px-s-4 py-s-3">{error}</div>}
          <Button intent="primary" size="lg" type="submit" isLoading={submitting} className="w-full justify-center">Send reset link</Button>
        </form>
      )}
    </AuthLayout>
  );
}
