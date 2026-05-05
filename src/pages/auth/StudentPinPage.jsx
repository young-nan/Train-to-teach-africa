/**
 * src/pages/auth/StudentPinPage.jsx
 *
 * Student sign-in for shared devices. School code + pupil code + 4-digit PIN.
 * The actual auth happens server-side via the student-pin-login edge function.
 *
 * UI is deliberately oversized and slow-paced — designed for 7-year-olds.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';

export default function StudentPinPage() {
  const { studentPinSignIn } = useAuth();
  const navigate = useNavigate();
  const [schoolCode, setSchoolCode] = useState('');
  const [pupilCode, setPupilCode] = useState('');
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await studentPinSignIn({ schoolCode, pupilCode, pin });
      navigate('/app/student');
    } catch (err) {
      setError('Could not sign in. Check your codes with your teacher.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Hello, learner."
      subtitle="Sign in to start your lesson."
      footer={<>Are you a parent or teacher? <Link to="/sign-in" className="text-gold-200 hover:text-gold-50">Sign in here</Link></>}
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-s-5" noValidate>
        <BigField label="School code" value={schoolCode} onChange={setSchoolCode} placeholder="e.g. LEK01" autoCapitalize="characters" />
        <BigField label="Your name code" value={pupilCode} onChange={setPupilCode} placeholder="e.g. ADAEZE-3E" autoCapitalize="characters" />
        <BigField label="Your PIN" value={pin} onChange={setPin} type="password" inputMode="numeric" maxLength={4} placeholder="••••" />

        {error && <div className="text-[14px] text-red-400 bg-red-400/10 border border-red-400/30 rounded-r-2 px-s-4 py-s-3">{error}</div>}

        <Button intent="primary" size="lg" type="submit" isLoading={submitting} className="w-full justify-center">
          Start learning
        </Button>
      </form>
    </AuthLayout>
  );
}

function BigField({ label, value, onChange, ...rest }) {
  return (
    <label className="flex flex-col gap-s-2">
      <span className="font-mono text-meta uppercase tracking-[0.14em] text-ink-3">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-surface-2 border border-line-2 rounded-r-2 px-s-5 py-s-4 text-[18px] text-ink-0 outline-none focus:border-gold-400 transition-colors duration-150 tracking-wider"
        {...rest}
      />
    </label>
  );
}
