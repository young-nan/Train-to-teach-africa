/**
 * SignIn.jsx — TTA EOS v3 sign-in page
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button, FormGroup, Input, Alert } from '@/components/ui';

export default function SignIn() {
  const navigate = useNavigate();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[var(--c-surface-0)] flex flex-col items-center justify-center px-4 product-glow-bg">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[13px] font-bold shrink-0"
          style={{ background: 'var(--c-gold-400)', color: '#1a1305' }}>
          TTA
        </div>
        <div className="font-heading font-bold text-[18px] text-[var(--c-ink-0)] tracking-tight">
          Train To Teach <span className="text-[var(--c-gold-400)] italic font-normal">Africa</span>
        </div>
      </div>

      {/* Card */}
      <div className="w-full max-w-[400px] bg-[var(--c-surface-1)] border border-[var(--c-line-2)] rounded-2xl p-8">
        <h1 className="font-heading text-[22px] font-bold text-[var(--c-ink-0)] mb-1">Welcome back</h1>
        <p className="text-[13px] text-[var(--c-ink-3)] mb-6">Sign in to your TTA account.</p>

        {error && (
          <div className="mb-4">
            <Alert type="error">{error}</Alert>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <FormGroup label="Email address">
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </FormGroup>

          <FormGroup label="Password">
            <Input
              type="password"
              placeholder="Your password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </FormGroup>

          <div className="flex items-center justify-end">
            <button
              type="button"
              className="text-[12px] text-[var(--product-accent)] hover:opacity-80 transition-opacity"
            >
              Forgot password?
            </button>
          </div>

          <Button
            variant="primary"
            type="submit"
            isLoading={loading}
            className="w-full justify-center py-3 text-[14px]"
          >
            Sign in
          </Button>
        </form>

        <div className="mt-5 text-center text-[12px] text-[var(--c-ink-3)]">
          Don't have an account?{' '}
          <Link to="/sign-up" className="text-[var(--product-accent)] font-medium hover:opacity-80">
            Sign up
          </Link>
        </div>
      </div>

      {/* Role hint strip */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2 max-w-[400px]">
        {['School Admin','Teacher','Parent','Student','Tutor'].map(role => (
          <span
            key={role}
            className="px-3 py-1 rounded-full text-[10px] font-semibold text-[var(--c-ink-4)] bg-[var(--c-surface-2)] border border-[var(--c-line-1)]"
          >
            {role}
          </span>
        ))}
      </div>
      <p className="text-[11px] text-[var(--c-ink-4)] mt-3">All roles access TTA through a single sign-in.</p>
    </div>
  );
}
