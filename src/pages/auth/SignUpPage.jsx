/**
 * src/pages/auth/SignUpPage.jsx
 *
 * Multi-step signup with role-specific data collection.
 *
 * STEP FLOW
 * ──────────
 * Step 1 — Role selection  (all roles)
 * Step 2 — Account details (name, email, password)
 * Step 3 — Role details    (phone, city/state, school name, etc.)
 * Step 4 — Subscription    (teacher solo, parent — school_admin skips to invite flow)
 * Step 5 — Confirmation    (email confirm screen or redirect)
 *
 * ROLE PATHS
 * ───────────
 * parent       → steps 1→2→3→4 (subscribe before dashboard)
 * teacher      → steps 1→2→3→4 (solo subscription, no school yet)
 * tutor        → steps 1→2→3→confirm (no subscription, approval-gated)
 * school_admin → steps 1→2→3→confirm (school pays via billing dashboard)
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { useAuth } from '@/hooks/useAuth';
import { ROLE_HOME } from '@/config/roles';
import { supabase } from '@/lib/supabase';

// ── Constants ─────────────────────────────────────────────────────────────────

const ROLE_OPTIONS = [
  {
    value: 'parent',
    label: 'Parent / Family',
    emoji: '👨‍👩‍👧',
    body:  'Support your child\'s learning with nightly activities, report access, and progress tracking.',
  },
  {
    value: 'teacher',
    label: 'Teacher',
    emoji: '📚',
    body:  'Individual lesson library, CPD content, and classroom tools — without needing a school account.',
  },
  {
    value: 'school_admin',
    label: 'School',
    emoji: '🏫',
    body:  'Full SIMS — attendance, gradebook, reports, parent comms, and billing for your whole school.',
  },
  {
    value: 'tutor',
    label: 'Tutor',
    emoji: '🎓',
    body:  'List your services, manage bookings, and earn through the TTA tutor marketplace.',
  },
];

const STATES_LIST = [
  // Nigeria
  'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno',
  'Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT','Gombe','Imo',
  'Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa',
  'Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba',
  'Yobe','Zamfara',
  // Ghana
  'Greater Accra','Ashanti','Northern','Western','Eastern','Central','Volta',
  // Kenya
  'Nairobi','Mombasa','Kisumu','Nakuru','Eldoret',
  // South Africa
  'Gauteng','Western Cape','KwaZulu-Natal','Eastern Cape',
  // Other
  'Other',
];

const CURRICULA = ['African (National)','Cambridge','IB','Montessori','French Curriculum','Other'];
const SUBJECTS  = [
  'English Language','Mathematics','Basic Science','Social Studies','Yoruba',
  'Igbo','Hausa','French','Creative Arts','Computer Studies','Physics',
  'Chemistry','Biology','Economics','Government','Literature',
];

// Roles that need a subscription before accessing their dashboard
const SUBSCRIPTION_ROLES = new Set(['parent', 'teacher']);

// ── Root ──────────────────────────────────────────────────────────────────────

export default function SignUpPage() {
  const { signUp, role: userRole, isAuthenticated } = useAuth();
  const navigate   = useNavigate();
  const [params]   = useSearchParams();
  const roleParam  = params.get('role');
  const planParam  = params.get('plan');

  const preRole = ['parent','teacher','school_admin','tutor'].includes(roleParam)
    ? roleParam : null;

  const [step,        setStep]        = useState(preRole ? 2 : 1);
  const [role,        setRole]        = useState(preRole ?? 'parent');
  const [signupState, setSignupState] = useState('idle'); // 'idle'|'confirm_email'|'awaiting_hydration'|'subscribe'
  const [error,       setError]       = useState(null);
  const [submitting,  setSubmitting]  = useState(false);
  const [createdEmail, setCreatedEmail] = useState('');

  // Step 2 — account fields
  const [fullName,  setFullName]  = useState('');
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');

  // Step 3 — role-specific fields
  const [phone,       setPhone]       = useState('');
  const [city,        setCity]        = useState('');
  const [state,       setState]       = useState('Lagos');
  const [schoolName,  setSchoolName]  = useState('');
  const [schoolType,  setSchoolType]  = useState('');
  const [curriculum,  setCurriculum]  = useState('Nigerian (NERDC)');
  const [childCount,  setChildCount]  = useState('1');
  const [childLevels, setChildLevels] = useState(''); // e.g. "Primary 2, JSS 1"
  const [teachSubject,setTeachSubject]= useState('');
  const [teachLevel,  setTeachLevel]  = useState('');
  const [bio,         setBio]         = useState('');
  const [teaches_online,  setTeachesOnline]  = useState(true);
  const [teaches_offline, setTeachesOffline] = useState(false);

  // Redirect once already authenticated
  useEffect(() => {
    if (signupState !== 'awaiting_hydration') return;
    if (!isAuthenticated || !userRole) return;
    if (SUBSCRIPTION_ROLES.has(role)) {
      setSignupState('subscribe');
    } else {
      navigate(ROLE_HOME[userRole] ?? '/', { replace: true });
    }
  }, [signupState, isAuthenticated, userRole, role, navigate]);

  // ── Step 1: Role selection ───────────────────────────────────────────────────
  if (step === 1) {
    return (
      <AuthLayout
        title="Who are you?"
        subtitle="Choose your role to get started. You can always switch later."
        footer={<>Already have an account? <Link to="/sign-in" className="text-gold-200 hover:text-gold-50">Sign in</Link></>}
      >
        <div className="grid grid-cols-1 gap-s-3">
          {ROLE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { setRole(opt.value); setStep(2); }}
              className={`w-full text-left bg-surface-2 border rounded-r-2 p-s-4 transition-all duration-150 hover:border-gold-400/60 hover:bg-surface-3 ${
                role === opt.value ? 'border-gold-400/60 bg-surface-3' : 'border-line-2'
              }`}
            >
              <div className="flex items-start gap-s-4">
                <span className="text-[24px] mt-[2px]">{opt.emoji}</span>
                <div>
                  <div className="font-display text-[15px] text-ink-0">{opt.label}</div>
                  <div className="mt-s-1 text-[12px] text-ink-2">{opt.body}</div>
                </div>
                <span className="ml-auto text-ink-3 mt-[2px]">→</span>
              </div>
            </button>
          ))}
        </div>
      </AuthLayout>
    );
  }

  // ── Email confirmation screen ────────────────────────────────────────────────
  if (signupState === 'confirm_email') {
    return (
      <AuthLayout title="Check your email." subtitle="We've sent a confirmation link to activate your account.">
        <div className="flex flex-col gap-s-5">
          <div className="bg-surface-2 border border-line-2 rounded-r-2 px-s-5 py-s-5 text-center">
            <div className="text-[32px] mb-s-3">✉️</div>
            <p className="text-[15px] text-ink-1 mb-s-2">
              We sent a link to <span className="text-ink-0 font-medium">{createdEmail}</span>.
            </p>
            <p className="text-[13px] text-ink-3">
              Click the link to activate your account, then sign in to complete setup.
              Check your spam folder if you don't see it.
            </p>
          </div>
          {role === 'tutor' && (
            <div className="bg-gold-400/10 border border-gold-400/20 rounded-r-2 px-s-4 py-s-4 text-[13px] text-ink-2">
              <p className="font-medium text-gold-200 mb-s-1">Next after confirming:</p>
              <ol className="space-y-s-1 list-decimal list-inside text-ink-3">
                <li>Sign in and complete your tutor profile</li>
                <li>Add subjects, availability, and guarantor</li>
                <li>Our team reviews and approves within 2 business days</li>
              </ol>
            </div>
          )}
          {role === 'school_admin' && (
            <div className="bg-gold-400/10 border border-gold-400/20 rounded-r-2 px-s-4 py-s-4 text-[13px] text-ink-2">
              <p className="font-medium text-gold-200 mb-s-1">After confirming:</p>
              <ol className="space-y-s-1 list-decimal list-inside text-ink-3">
                <li>Sign in to your school dashboard</li>
                <li>Add classes and enrol pupils</li>
                <li>Subscribe to unlock full features</li>
              </ol>
            </div>
          )}
          <p className="text-[13px] text-ink-3 text-center">
            Wrong email?{' '}
            <button type="button" onClick={() => { setSignupState('idle'); setStep(2); }}
              className="text-gold-200 hover:text-gold-50 underline">
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

  // ── Subscribe screen (after account created) ──────────────────────────────
  if (signupState === 'subscribe') {
    return <SubscribeAfterSignup role={role} />;
  }

  // ── Step 2: Account details ──────────────────────────────────────────────────
  if (step === 2) {
    return (
      <AuthLayout
        title="Create your account."
        subtitle={ROLE_OPTIONS.find(r => r.value === role)?.label ?? 'Account details'}
        footer={<>Already have an account? <Link to="/sign-in" className="text-gold-200 hover:text-gold-50">Sign in</Link></>}
      >
        <div className="flex flex-col gap-s-5">
          {/* Back */}
          <button type="button" onClick={() => setStep(1)}
            className="text-left font-mono text-[12px] text-ink-3 hover:text-ink-1">
            ← Back
          </button>

          {/* Progress */}
          <StepDots current={2} total={SUBSCRIPTION_ROLES.has(role) ? 4 : 3} />

          <form onSubmit={(e) => { e.preventDefault(); setStep(3); }} className="flex flex-col gap-s-5">
            <Field label="Full name" type="text" value={fullName} onChange={setFullName}
              autoComplete="name" required placeholder="Adaeze Okonkwo" />
            <Field label="Email" type="email" value={email} onChange={setEmail}
              autoComplete="email" required placeholder="you@example.com" />
            <Field label="Password (min 8 characters)" type="password" value={password}
              onChange={setPassword} autoComplete="new-password" required minLength={8} />

            <Button intent="primary" size="lg" type="submit"
              disabled={!fullName.trim() || !email.trim() || password.length < 8}
              className="w-full justify-center">
              Continue →
            </Button>

            <p className="text-[12px] text-ink-3 text-center">
              By continuing you agree to our{' '}
              <Link to="/terms" className="text-gold-200 hover:text-gold-50 underline">Terms</Link>
              {' '}and{' '}
              <Link to="/privacy" className="text-gold-200 hover:text-gold-50 underline">Privacy Policy</Link>.
            </p>
          </form>
        </div>
      </AuthLayout>
    );
  }

  // ── Step 3: Role-specific profile details ────────────────────────────────────
  if (step === 3) {
    const handleSubmit = async (e) => {
      e.preventDefault();
      setError(null);
      setSubmitting(true);
      try {
        // Build extra metadata to store in raw_user_meta_data
        const extraMeta = buildRoleMeta({
          role, phone, city, state, schoolName, schoolType, curriculum,
          childCount, childLevels, teachSubject, teachLevel, bio,
          teaches_online, teaches_offline,
        });
        const { confirmationRequired } = await signUp({
          email, password, fullName, role,
          phone, city, state,
          ...extraMeta,
        });
        setCreatedEmail(email);
        if (confirmationRequired) {
          setSignupState('confirm_email');
        } else {
          setSignupState('awaiting_hydration');
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setSubmitting(false);
      }
    };

    return (
      <AuthLayout
        title={roleTitles[role] ?? 'Tell us about yourself.'}
        subtitle="We'll use this to personalise your experience."
      >
        <div className="flex flex-col gap-s-5">
          <button type="button" onClick={() => setStep(2)}
            className="text-left font-mono text-[12px] text-ink-3 hover:text-ink-1">
            ← Back
          </button>
          <StepDots current={3} total={SUBSCRIPTION_ROLES.has(role) ? 4 : 3} />

          <form onSubmit={handleSubmit} className="flex flex-col gap-s-5">

            {/* Phone — all roles */}
            <Field label="Phone number" type="tel" value={phone} onChange={setPhone}
              placeholder="+234 801 234 5678" autoComplete="tel" required />

            {/* PARENT fields */}
            {role === 'parent' && <>
              <Field label="City" type="text" value={city} onChange={setCity}
                placeholder="e.g. Lagos" required />
              <SelectField label="State or region" value={state} onChange={setState} options={STATES_LIST} />
              <Field label="Number of children" type="number" value={childCount}
                onChange={setChildCount} min="1" max="10" required />
              <Field label="Children's school levels (optional)" type="text"
                value={childLevels} onChange={setChildLevels}
                placeholder="e.g. Nursery 2, Primary 4" />
              <SelectField label="Preferred curriculum" value={curriculum}
                onChange={setCurriculum} options={CURRICULA} />
            </>}

            {/* TEACHER fields */}
            {role === 'teacher' && <>
              <Field label="City" type="text" value={city} onChange={setCity}
                placeholder="e.g. Abuja" required />
              <SelectField label="State or region" value={state} onChange={setState} options={STATES_LIST} />
              <SelectField label="Primary subject" value={teachSubject}
                onChange={setTeachSubject} options={['', ...SUBJECTS]}
                required placeholder="Select a subject" />
              <Field label="Class levels you teach" type="text" value={teachLevel}
                onChange={setTeachLevel} placeholder="e.g. Primary 4–6, JSS 1–3" />
              <SelectField label="Curriculum" value={curriculum}
                onChange={setCurriculum} options={CURRICULA} />
            </>}

            {/* SCHOOL_ADMIN fields */}
            {role === 'school_admin' && <>
              <Field label="School name" type="text" value={schoolName}
                onChange={setSchoolName} placeholder="Greenfield Academy" required />
              <Field label="City" type="text" value={city} onChange={setCity}
                placeholder="e.g. Lagos" required />
              <SelectField label="State or region" value={state} onChange={setState} options={STATES_LIST} />
              <SelectField label="School type" value={schoolType} onChange={setSchoolType}
                options={['', 'Private', 'Public', 'International', 'Mission']}
                required placeholder="Select school type" />
              <SelectField label="Curriculum" value={curriculum}
                onChange={setCurriculum} options={CURRICULA} />
            </>}

            {/* TUTOR fields */}
            {role === 'tutor' && <>
              <Field label="City" type="text" value={city} onChange={setCity}
                placeholder="e.g. Accra, Nairobi" required />
              <SelectField label="State or region" value={state} onChange={setState} options={STATES_LIST} />
              <SelectField label="Primary subject" value={teachSubject}
                onChange={setTeachSubject} options={['', ...SUBJECTS]}
                required placeholder="Select a subject" />
              <Field label="Short bio" type="text" value={bio} onChange={setBio}
                placeholder="Experienced Mathematics tutor with 5 years in secondary schools…" />
              <div className="space-y-s-2">
                <span className="font-mono text-meta uppercase tracking-[0.14em] text-ink-3 block">
                  Session format
                </span>
                <label className="flex items-center gap-s-3 cursor-pointer">
                  <input type="checkbox" checked={teaches_online}
                    onChange={(e) => setTeachesOnline(e.target.checked)}
                    className="w-4 h-4 accent-gold-400" />
                  <span className="text-[14px] text-ink-1">Online sessions</span>
                </label>
                <label className="flex items-center gap-s-3 cursor-pointer">
                  <input type="checkbox" checked={teaches_offline}
                    onChange={(e) => setTeachesOffline(e.target.checked)}
                    className="w-4 h-4 accent-gold-400" />
                  <span className="text-[14px] text-ink-1">In-person sessions</span>
                </label>
              </div>
            </>}

            {error && (
              <div className="text-[13px] text-red-400 bg-red-400/10 border border-red-400/30 rounded-r-2 px-s-4 py-s-3">
                {error}
              </div>
            )}

            <Button intent="primary" size="lg" type="submit"
              isLoading={submitting}
              disabled={submitting || !phone.trim()}
              className="w-full justify-center">
              {SUBSCRIPTION_ROLES.has(role)
                ? 'Continue to subscription →'
                : (role === 'tutor' ? 'Submit application' : 'Create account')}
            </Button>
          </form>
        </div>
      </AuthLayout>
    );
  }

  return null;
}

// ── Subscribe after signup ────────────────────────────────────────────────────

function SubscribeAfterSignup({ role }) {
  const navigate = useNavigate();
  const [currency, setCurrency] = useState('NGN');

  const { data: tiers, isLoading } = useQuery({
    queryKey: ['signup-tiers', role, currency],
    queryFn: async () => {
      const audience = role === 'teacher' ? 'teacher' : 'parent';
      const { data, error } = await supabase
        .from('subscription_tiers')
        .select('*')
        .eq('audience', audience)
        .eq('currency', currency)
        .eq('active', true)
        .order('price_minor');
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    staleTime: 60_000,
  });

  const fmtPrice = (minor, curr) => {
    if (curr === 'NGN') return `₦${(minor / 100).toLocaleString('en-NG')}`;
    return `$${(minor / 100).toFixed(2)}`;
  };

  const roleLabel = role === 'teacher' ? 'Teacher' : 'Parent';
  const roleHome  = role === 'teacher' ? '/app/teacher' : '/app/parent';

  return (
    <AuthLayout
      title={`Choose your ${roleLabel} plan.`}
      subtitle="Unlock the full platform. Cancel any time."
    >
      <div className="space-y-s-5">
        <StepDots current={4} total={4} />

        {/* Currency toggle */}
        <div className="flex items-center gap-s-2">
          <span className="font-mono text-[12px] text-ink-3">Currency:</span>
          {['NGN', 'USD'].map((c) => (
            <button key={c} type="button"
              onClick={() => setCurrency(c)}
              className={`px-s-3 py-[4px] rounded-full font-mono text-[11px] border transition-all ${
                currency === c
                  ? 'bg-gold-400/20 border-gold-400/40 text-gold-200'
                  : 'bg-surface-2 border-line-2 text-ink-3'
              }`}>
              {c}
            </button>
          ))}
        </div>

        {/* Tier cards */}
        {isLoading && (
          <div className="space-y-s-3">
            {[1,2].map(i => <div key={i} className="h-[90px] bg-surface-2 rounded-r-3 border border-line-1 animate-pulse" />)}
          </div>
        )}
        {!isLoading && (tiers ?? []).map((tier) => (
          <div key={tier.id}
            className="bg-surface-2 border border-line-2 rounded-r-3 px-s-5 py-s-4 flex items-center justify-between gap-s-4">
            <div>
              <div className="text-[15px] font-medium text-ink-0">
                {tier.period === 'term' ? 'Per term' : 'Annual'} plan
              </div>
              <div className="text-[13px] text-ink-3 mt-[2px]">
                {fmtPrice(tier.price_minor, tier.currency)}
                {tier.period === 'term' ? ' / term' : ' / year'}
                {tier.period === 'annual' && (
                  <span className="ml-s-2 text-green-400 text-[11px]">Save ~20%</span>
                )}
              </div>
            </div>
            <Button
              intent={tier.period === 'annual' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => navigate(`/billing/checkout?tier=${tier.id}`)}
            >
              Subscribe
            </Button>
          </div>
        ))}

        {/* Skip for now */}
        <div className="text-center">
          <button type="button"
            onClick={() => navigate(roleHome, { replace: true })}
            className="font-mono text-[12px] text-ink-4 hover:text-ink-2 underline">
            Skip for now — explore with limited access
          </button>
        </div>
      </div>
    </AuthLayout>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const roleTitles = {
  parent:       'About your family.',
  teacher:      'About your teaching.',
  school_admin: 'About your school.',
  tutor:        'Your tutor profile.',
};

function buildRoleMeta({ role, phone, city, state, schoolName, schoolType,
  curriculum, childCount, childLevels, teachSubject, teachLevel, bio,
  teaches_online, teaches_offline }) {
  const base = { phone, city, state };
  if (role === 'parent')       return { ...base, curriculum, child_count: childCount, child_levels: childLevels };
  if (role === 'teacher')      return { ...base, teach_subject: teachSubject, teach_level: teachLevel, curriculum };
  if (role === 'school_admin') return { ...base, school_name: schoolName, school_type: schoolType, curriculum };
  if (role === 'tutor')        return { ...base, bio, teach_subject: teachSubject, teaches_online, teaches_offline };
  return base;
}

function StepDots({ current, total }) {
  return (
    <div className="flex items-center gap-s-2">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`h-[3px] rounded-full transition-all duration-300 ${
          i + 1 <= current ? 'bg-gold-400 flex-1' : 'bg-line-2 flex-1'
        }`} />
      ))}
    </div>
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
        className="bg-surface-2 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[15px] text-ink-0 outline-none focus:border-gold-400 transition-colors duration-150 placeholder-ink-4"
        {...rest}
      />
    </label>
  );
}

function SelectField({ label, value, onChange, options, placeholder, ...rest }) {
  return (
    <label className="flex flex-col gap-s-2">
      <span className="font-mono text-meta uppercase tracking-[0.14em] text-ink-3">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-surface-2 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[15px] text-ink-0 outline-none focus:border-gold-400 transition-colors duration-150"
        {...rest}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}
