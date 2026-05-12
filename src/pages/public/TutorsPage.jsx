/**
 * src/pages/public/TutorsPage.jsx
 *
 * Public marketing page for the tutor network. Two purposes:
 *
 *   1. SUPPLY-SIDE: Tell prospective tutors what TTA's tutor marketplace
 *      will offer (when launched), and capture their interest as a lead.
 *
 *   2. DEMAND-SIDE SIGNAL: Parents who land here see "tutoring is coming"
 *      messaging — primes them for a future product, gets us a feel for
 *      organic interest.
 *
 * NO actual marketplace functionality lives here. Search / booking / payment
 * is v2. The form writes to `tutor_leads`. We email new leads when the
 * marketplace opens.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PublicNav } from '@/components/marketing/PublicNav';
import { PublicFooter } from '@/components/marketing/PublicFooter';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Card } from '@/components/ui/Card';
import * as tutorLeadService from '@/services/tutorLeadService';
import { cn } from '@/utils/cn';

const SUBJECT_OPTIONS = [
  'Mathematics', 'English Language', 'Basic Science', 'Physics',
  'Chemistry', 'Biology', 'Further Maths', 'Verbal Reasoning',
  'Quantitative Reasoning', 'French', 'Yoruba', 'Igbo', 'Hausa',
  'Coding', 'Music', 'Art',
];

const CURRICULUM_OPTIONS = [
  'NERDC (Nigerian)', 'Cambridge IGCSE', 'IB', 'Montessori', 'NAPPS',
];

export default function TutorsPage() {
  return (
    <div className="min-h-dvh bg-surface-1 text-ink-1">
      <PublicNav />
      <main className="pt-[64px]">
        <Hero />
        <WhyTeach />
        <LeadForm />
      </main>
      <PublicFooter />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-line-1">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 70% 60% at 50% 0%, rgba(229,166,42,.08), transparent 60%)',
        }}
        aria-hidden="true"
      />
      <div className="relative max-w-[1280px] mx-auto px-s-6 lg:px-s-9 py-s-10">
        <Chip variant="gold" dot>For tutors · Coming soon</Chip>
        <h1 className="mt-s-5 font-display text-display-1 text-ink-0 max-w-[18ch]">
          Teach. Earn. <span className="ital-gold">On your terms.</span>
        </h1>
        <p className="mt-s-6 text-body-l text-ink-2 max-w-[60ch]">
          We're building a marketplace that connects qualified Nigerian
          tutors with parents who need them — online and in homes across
          Africa, and beyond. Sign up to be one of the
          first.
        </p>
        <div className="mt-s-7 flex flex-wrap gap-s-3">
          <a href="#join">
            <Button intent="primary" size="lg">Join the network</Button>
          </a>
          <Link to="/about">
            <Button intent="ghost" size="lg">About TTA →</Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

function WhyTeach() {
  const reasons = [
    {
      title: 'Set your own rate.',
      body: 'You decide what your time is worth. Online and in-person rates can differ. Adjust whenever you want.',
    },
    {
      title: 'Verified families only.',
      body: 'Every parent on the platform has paid a subscription. No tire-kickers. No no-shows. Real demand.',
    },
    {
      title: 'Paid promptly.',
      body: 'Sessions paid for via Paystack at booking. Funds settle to you on a weekly schedule. No chasing.',
    },
    {
      title: 'Online or offline — your call.',
      body: 'Tutor by Zoom from anywhere, or in homes within your city. Most tutors do both. Offline gigs need a guarantor.',
    },
  ];
  return (
    <section className="py-s-10 border-b border-line-1">
      <div className="max-w-[1280px] mx-auto px-s-6 lg:px-s-9">
        <h2 className="font-display text-display-2 text-ink-0 mb-s-7">
          Why teach with us.
        </h2>
        <div className="grid md:grid-cols-2 gap-s-5">
          {reasons.map((r) => (
            <Card key={r.title} className="hover:border-gold-400/30 transition-colors">
              <h3 className="font-display text-display-3 text-ink-0">{r.title}</h3>
              <p className="mt-s-3 text-body text-ink-2">{r.body}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function LeadForm() {
  const [form, setForm] = useState({
    fullName: '', email: '', phone: '',
    city: '', state: '',
    subjects: [], curriculum: [],
    yearsExperience: '', availability: '', notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const toggleArr = (k, value) => setForm((f) => ({
    ...f,
    [k]: f[k].includes(value) ? f[k].filter((x) => x !== value) : [...f[k], value],
  }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await tutorLeadService.submitTutorLead({
        ...form,
        yearsExperience: form.yearsExperience ? Number(form.yearsExperience) : null,
      });
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <section id="join" className="py-s-10">
        <div className="max-w-[680px] mx-auto px-s-6 lg:px-s-9">
          <Card className="text-center">
            <Chip variant="green" dot>Submitted</Chip>
            <h2 className="mt-s-5 font-display text-display-2 text-ink-0">
              You're on the list.
            </h2>
            <p className="mt-s-4 text-body text-ink-2">
              We'll email you the moment the tutor marketplace opens —
              expected first half of {new Date().getFullYear() + (new Date().getMonth() > 5 ? 1 : 0)}.
              In the meantime, watch your inbox for early-tutor briefings.
            </p>
            <div className="mt-s-7">
              <Link to="/"><Button intent="ghost" size="md">← Back to home</Button></Link>
            </div>
          </Card>
        </div>
      </section>
    );
  }

  return (
    <section id="join" className="py-s-10">
      <div className="max-w-[680px] mx-auto px-s-6 lg:px-s-9">
        <h2 className="font-display text-display-2 text-ink-0 mb-s-3">
          Join the network.
        </h2>
        <p className="text-body text-ink-2 mb-s-7">
          Tell us about yourself. We'll be in touch when we open onboarding.
          Required fields are marked with an asterisk.
        </p>

        <form onSubmit={onSubmit} className="flex flex-col gap-s-5" noValidate>
          <Field label="Full name *">
            <input
              type="text" value={form.fullName} required
              onChange={(e) => update('fullName', e.target.value)}
              autoComplete="name"
              className="bg-surface-2 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[15px] text-ink-0 outline-none focus:border-gold-400"
            />
          </Field>
          <div className="grid sm:grid-cols-2 gap-s-4">
            <Field label="Email *">
              <input
                type="email" value={form.email} required
                onChange={(e) => update('email', e.target.value)}
                autoComplete="email"
                className="bg-surface-2 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[15px] text-ink-0 outline-none focus:border-gold-400"
              />
            </Field>
            <Field label="Phone *">
              <input
                type="tel" value={form.phone} required
                onChange={(e) => update('phone', e.target.value)}
                autoComplete="tel"
                placeholder="+234…"
                className="bg-surface-2 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[15px] text-ink-0 outline-none focus:border-gold-400"
              />
            </Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-s-4">
            <Field label="City">
              <input
                type="text" value={form.city}
                onChange={(e) => update('city', e.target.value)}
                placeholder="Lagos"
                className="bg-surface-2 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[15px] text-ink-0 outline-none focus:border-gold-400"
              />
            </Field>
            <Field label="State">
              <input
                type="text" value={form.state}
                onChange={(e) => update('state', e.target.value)}
                placeholder="Lagos"
                className="bg-surface-2 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[15px] text-ink-0 outline-none focus:border-gold-400"
              />
            </Field>
          </div>

          <Field label="Subjects you teach (tap to select)">
            <ChipGrid
              options={SUBJECT_OPTIONS}
              selected={form.subjects}
              onToggle={(v) => toggleArr('subjects', v)}
            />
          </Field>

          <Field label="Curriculum expertise">
            <ChipGrid
              options={CURRICULUM_OPTIONS}
              selected={form.curriculum}
              onToggle={(v) => toggleArr('curriculum', v)}
            />
          </Field>

          <div className="grid sm:grid-cols-2 gap-s-4">
            <Field label="Years experience">
              <input
                type="number" min={0} max={60} value={form.yearsExperience}
                onChange={(e) => update('yearsExperience', e.target.value)}
                className="bg-surface-2 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[15px] text-ink-0 outline-none focus:border-gold-400"
              />
            </Field>
            <Field label="Availability">
              <input
                type="text" value={form.availability}
                onChange={(e) => update('availability', e.target.value)}
                placeholder="e.g. Weekday evenings + Saturdays"
                className="bg-surface-2 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[15px] text-ink-0 outline-none focus:border-gold-400"
              />
            </Field>
          </div>

          <Field label="Anything else?">
            <textarea
              value={form.notes} rows={4}
              onChange={(e) => update('notes', e.target.value)}
              placeholder="Optional. Tell us about your teaching philosophy, qualifications, or specific needs."
              className="bg-surface-2 border border-line-2 rounded-r-2 px-s-4 py-s-3 text-[15px] text-ink-0 outline-none focus:border-gold-400 resize-none"
              maxLength={500}
            />
          </Field>

          {error && (
            <div className="text-[13px] text-red-400 bg-red-400/10 border border-red-400/30 rounded-r-2 px-s-4 py-s-3">
              {error}
            </div>
          )}

          <div className="pt-s-3">
            <Button
              intent="primary" size="lg" type="submit"
              isLoading={submitting}
              className="w-full justify-center"
            >
              Submit
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-s-2">
      <span className="font-mono text-meta uppercase tracking-[0.14em] text-ink-3">{label}</span>
      {children}
    </label>
  );
}

function ChipGrid({ options, selected, onToggle }) {
  return (
    <div className="flex flex-wrap gap-s-2">
      {options.map((opt) => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onToggle(opt)}
            className={cn(
              'px-s-4 py-[7px] rounded-full text-[12.5px] font-medium border transition-all duration-150',
              active
                ? 'bg-gold-400/15 border-gold-400/40 text-gold-200'
                : 'bg-surface-2 border-line-2 text-ink-2 hover:text-ink-1 hover:border-line-3',
            )}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}
