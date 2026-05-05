/**
 * src/pages/public/PricingPage.jsx
 *
 * The public pricing page. ZERO hardcoded prices — every value comes from
 * /src/config/pricing.js. If a price ever needs to change, it changes
 * there and propagates to checkout, admin billing, and this page in one
 * commit.
 *
 * Implements the brief's exact UX requirements:
 *   - African / International curriculum toggle
 *   - Term / Annual cadence toggle
 *   - "Subscribe" + "Talk to Sales" CTAs per card
 *   - FX disclaimer (auto-generated from FX object)
 */

import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PublicNav } from '@/components/marketing/PublicNav';
import { PublicFooter } from '@/components/marketing/PublicFooter';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { PLANS, FX, formatPrice, formatUsdEquivalent, plansFor } from '@/config/pricing';
import { cn } from '@/utils/cn';

const AUDIENCES = [
  { code: 'parent', label: 'Parents' },
  { code: 'teacher', label: 'Teachers' },
  { code: 'school', label: 'Schools' },
];

export default function PricingPage() {
  const [track, setTrack] = useState('african');     // 'african' | 'international'
  const [cadence, setCadence] = useState('term');    // 'term' | 'annual'
  const navigate = useNavigate();

  return (
    <div className="min-h-dvh bg-surface-1 text-ink-1">
      <PublicNav />
      <main className="pt-[64px]">
        {/* Header */}
        <section className="border-b border-line-1">
          <div className="max-w-[1280px] mx-auto px-s-6 lg:px-s-9 py-s-10">
            <Chip variant="gold" dot>Pricing</Chip>
            <h1 className="mt-s-5 font-display text-display-1 text-ink-0">
              Pricing built for the way <span className="ital-gold">African families pay.</span>
            </h1>
            <p className="mt-s-5 text-body-l text-ink-2 max-w-[60ch]">
              African curriculum prices are denominated in Naira and stay
              fixed — no FX surprises. International curriculum prices are in
              US Dollars.
            </p>
          </div>
        </section>

        {/* Toggles */}
        <section className="border-b border-line-1 py-s-7 sticky top-[64px] bg-surface-1/85 backdrop-blur-md z-40">
          <div className="max-w-[1280px] mx-auto px-s-6 lg:px-s-9 flex flex-wrap gap-s-5 items-center justify-between">
            <Toggle
              label="Curriculum"
              value={track}
              onChange={setTrack}
              options={[
                { code: 'african', label: 'African curriculum' },
                { code: 'international', label: 'International curriculum' },
              ]}
            />
            <Toggle
              label="Billing"
              value={cadence}
              onChange={setCadence}
              options={[
                { code: 'term', label: 'Per term' },
                { code: 'annual', label: 'Annual' },
              ]}
            />
          </div>
        </section>

        {/* Cards */}
        <section className="py-s-10">
          <div className="max-w-[1280px] mx-auto px-s-6 lg:px-s-9">
            <div className="grid md:grid-cols-3 gap-s-5">
              {AUDIENCES.map((aud) => {
                // Try the requested cadence; fall back to term if no annual exists
                // (e.g. teachers don't have an annual plan in the brief).
                const plans = plansFor({ track, audience: aud.code, cadence });
                const fallback = plans.length ? plans : plansFor({ track, audience: aud.code, cadence: 'term' });
                const plan = fallback[0];
                if (!plan) return null;

                return (
                  <PriceCard
                    key={aud.code}
                    plan={plan}
                    audience={aud.label}
                    featured={aud.code === 'teacher'}
                    cadenceFallback={!plans.length}
                    onSubscribe={() => navigate(`/sign-up?plan=${plan.code}`)}
                  />
                );
              })}
            </div>

            {/* Disclaimer — only meaningful for African track */}
            {track === 'african' && (
              <p className="mt-s-9 max-w-[80ch] mx-auto font-mono text-meta text-ink-3 leading-relaxed text-center">
                {FX.disclaimer}
              </p>
            )}
          </div>
        </section>

        <FaqSection />
      </main>
      <PublicFooter />
    </div>
  );
}

// ---------------------------------------------------------------------------

function Toggle({ label, value, onChange, options }) {
  return (
    <div className="flex items-center gap-s-3">
      <span className="font-mono text-meta uppercase text-ink-3">{label}</span>
      <div role="tablist" className="bg-surface-2 border border-line-2 rounded-full p-[3px] flex">
        {options.map((opt) => (
          <button
            key={opt.code}
            role="tab"
            aria-selected={value === opt.code}
            onClick={() => onChange(opt.code)}
            className={cn(
              'px-s-4 py-[6px] text-[12.5px] rounded-full transition-all duration-150 font-medium',
              value === opt.code
                ? 'bg-gold-400 text-[#1a1305]'
                : 'text-ink-2 hover:text-ink-0',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PriceCard({ plan, audience, featured, cadenceFallback, onSubscribe }) {
  const usd = formatUsdEquivalent(plan);
  const isAnnual = plan.cadence === 'annual';

  return (
    <div className={cn(
      'rounded-r-4 p-s-7 flex flex-col gap-s-5 relative',
      featured
        ? 'bg-surface-2 border-2 border-gold-400/50 shadow-gold'
        : 'bg-surface-2 border border-line-1',
    )}>
      {featured && (
        <div className="absolute -top-[14px] left-s-7">
          <Chip variant="gold" dot>Most popular</Chip>
        </div>
      )}
      <div>
        <div className="font-mono text-eyebrow uppercase text-gold-400">{audience}</div>
        <div className="mt-s-3 flex items-baseline gap-s-3 flex-wrap">
          <div className="font-display text-[44px] leading-none tracking-[-0.02em] text-ink-0">
            {formatPrice(plan)}
          </div>
          {usd && (
            <div className="font-mono text-meta text-ink-3">≈ {usd}</div>
          )}
        </div>
        <div className="mt-s-2 font-mono text-meta text-ink-3">
          {isAnnual ? 'per year' : 'per term'}
          {plan.saveHint && isAnnual && <span className="ml-s-3 text-gold-200">· {plan.saveHint}</span>}
        </div>
        {cadenceFallback && (
          <div className="mt-s-2 font-mono text-[10px] text-ink-3 italic">
            Annual not available for this audience — showing term pricing.
          </div>
        )}
      </div>

      <ul className="flex flex-col gap-s-3 text-[13.5px] text-ink-1 border-t border-line-1 pt-s-5">
        {featuresFor(plan).map((f) => (
          <li key={f} className="flex items-start gap-s-3">
            <CheckIcon />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-s-3 flex flex-col gap-s-3">
        <Button intent="primary" size="md" onClick={onSubscribe} className="w-full justify-center">
          Subscribe
        </Button>
        <Link to="/solutions/schools" className="text-center">
          <Button intent="ghost" size="md" className="w-full justify-center">
            Talk to sales →
          </Button>
        </Link>
      </div>
    </div>
  );
}

function featuresFor(plan) {
  if (plan.audience === 'parent') {
    return [
      'Up to 4 children on one subscription',
      'Daily 5-minute home activity',
      'WhatsApp support',
      'Term reports for every child',
    ];
  }
  if (plan.audience === 'teacher') {
    return [
      'Full lesson library + answer keys',
      'In-context CPD modules',
      'Gradebook + auto-reports',
      'Curriculum-aligned pacing',
    ];
  }
  // school
  return [
    'Up to 200 pupils included',
    'Full SIMS — attendance, scores, reports',
    'Parent portal for every family',
    'Onboarding + teacher CPD included',
  ];
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="mt-[3px] flex-shrink-0">
      <circle cx="12" cy="12" r="10" fill="rgba(229,166,42,.12)" stroke="rgba(229,166,42,.5)" strokeWidth="1"/>
      <path d="M8 12.5l2.5 2.5L16 9" stroke="#e5a62a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function FaqSection() {
  const faqs = [
    {
      q: 'Are NGN prices fixed?',
      a: 'Yes. African curriculum prices are denominated in Naira and stay fixed regardless of FX movement. The USD equivalent shown next to the NGN price is informational only.',
    },
    {
      q: 'Can I switch between term and annual billing?',
      a: 'Yes — at any renewal point. We pro-rate intelligently so you never pay twice for the same period.',
    },
    {
      q: 'Do you support transfer or USSD?',
      a: 'Yes. Paystack handles bank transfer, USSD, and card. You don\'t need a bank card to subscribe.',
    },
    {
      q: 'What happens if my school grows past 200 pupils?',
      a: 'Talk to sales — we\'ll quote a custom enterprise tier. The platform is designed for school groups; we\'ve worked with 6-school operators.',
    },
  ];
  return (
    <section className="py-s-10 border-t border-line-1">
      <div className="max-w-[1280px] mx-auto px-s-6 lg:px-s-9">
        <h2 className="font-display text-display-2 text-ink-0">Common questions.</h2>
        <div className="mt-s-9 grid md:grid-cols-2 gap-s-5">
          {faqs.map((f) => (
            <div key={f.q} className="bg-surface-2 border border-line-1 rounded-r-3 p-s-7">
              <div className="font-display text-display-3 text-ink-0">{f.q}</div>
              <p className="mt-s-3 text-body text-ink-2">{f.a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
