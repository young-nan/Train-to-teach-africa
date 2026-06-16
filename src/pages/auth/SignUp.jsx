/**
 * SignUp.jsx — TTA EOS v3 registration page
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button, FormGroup, Input, Select, Alert } from '@/components/ui';

const ROLES = [
  { value: 'parent',       label: 'Parent / Guardian'  },
  { value: 'teacher',      label: 'Teacher'             },
  { value: 'school_admin', label: 'School Administrator'},
  { value: 'student',      label: 'Student'             },
  { value: 'tutor',        label: 'Private Tutor'       },
];

export default function SignUp() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', password: '', role: '',
  });
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const update = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.role) { setError('Please select your role.'); return; }
    setLoading(true);

    const { data, error: signUpErr } = await supabase.auth.signUp({
      email:    form.email,
      password: form.password,
      options:  {
        data: {
          first_name: form.first_name,
          last_name:  form.last_name,
          role:       form.role,
        },
      },
    });

    if (signUpErr) { setError(signUpErr.message); setLoading(false); return; }
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[var(--c-surface-0)] flex flex-col items-center justify-center px-4 py-10 product-glow-bg">
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

      <div className="w-full max-w-[440px] bg-[var(--c-surface-1)] border border-[var(--c-line-2)] rounded-2xl p-8">
        <h1 className="font-heading text-[22px] font-bold text-[var(--c-ink-0)] mb-1">Create your account</h1>
        <p className="text-[13px] text-[var(--c-ink-3)] mb-6">Join TTA — Africa's education operating system.</p>

        {error && (
          <div className="mb-4"><Alert type="error">{error}</Alert></div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormGroup label="First name">
              <Input placeholder="Chidi" value={form.first_name} onChange={update('first_name')} required />
            </FormGroup>
            <FormGroup label="Last name">
              <Input placeholder="Obi" value={form.last_name} onChange={update('last_name')} required />
            </FormGroup>
          </div>

          <FormGroup label="I am a…">
            <Select value={form.role} onChange={update('role')} required>
              <option value="">Select your role…</option>
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </Select>
          </FormGroup>

          <FormGroup label="Email address">
            <Input type="email" placeholder="you@example.com" value={form.email} onChange={update('email')} required autoComplete="email" />
          </FormGroup>

          <FormGroup label="Password" hint="At least 8 characters.">
            <Input type="password" placeholder="Choose a password" value={form.password} onChange={update('password')} required minLength={8} autoComplete="new-password" />
          </FormGroup>

          <Button variant="primary" type="submit" isLoading={loading} className="w-full justify-center py-3 text-[14px]">
            Create account
          </Button>
        </form>

        <div className="mt-5 text-center text-[12px] text-[var(--c-ink-3)]">
          Already have an account?{' '}
          <Link to="/sign-in" className="text-[var(--product-accent)] font-medium hover:opacity-80">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
