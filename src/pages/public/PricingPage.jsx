/**
 * src/pages/public/PricingPage.jsx
 *
 * PUBLIC pricing page — /pricing
 *
 * WHAT CHANGED FROM THE PREVIOUS VERSION
 * ───────────────────────────────────────
 * Prices now come from the `subscription_tiers` database table via
 * `tiersService.listActiveTiers()`. When a super admin changes a price in
 * the Tiers dashboard, it updates the DB row. This page picks it up within
 * 60 seconds (staleTime) — no redeploy required.
 *
 * The previous version imported from `src/config/pricing.js` — a hardcoded
 * file that the admin dashboard could not update.
 *
 * FALLBACK STRATEGY
 * ─────────────────
 * If the DB query fails (network error, Supabase outage, pre-auth cold start),
 * the page falls back to `PLANS` from `pricing.js`. A visitor never sees
 * a broken pricing page — they see the last-known static prices with a
 * small "prices may be out of date" notice.
 *
 * UX IS IDENTICAL TO THE PREVIOUS VERSION
 * ─────────────────────────────────────────
 * - African / International curriculum toggle
 * - Per term / Annual cadence toggle  
 * - Three audience cards: Parents, Teachers, Schools
 * - School card uses "Talk to sales" CTA (no self-serve Paystack button)
 * - Annual save hint shown when cadence is 'annual'
 * - USD equivalent shown under NGN prices
 * - FX disclaimer shown for African curriculum
 * - FAQ section unchanged
 */

import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PublicNav } from '@/components/marketing/PublicNav';
import { PublicFooter } from '@/components/marketing/PublicFooter';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import {
  PLANS as STATIC_PLANS,
  FX,
  formatUsdEquivalent as staticUsdEquiv,
} from '@/config/pricing';
import * as tiersService from '@/services/tiersService';
import { cn } from '@/utils/cn';

// ── Constants ─────────────────────────────────────────────────────────────────

const AUDIENCES = [
  {
    code:        'parent',
    label:       'Parents',
    featured:    false,
    selfServe:   true,   // ← shows Subscribe button
    features: [
      'Daily 5-minute home activity',
      'Nightly WhatsApp lesson delivery',
      'Personalised lesson PDFs each term',
      'Term reports for every child',
    ],
  },
  {
    code:        'teacher',
    label:       'Teachers',
    featured:    true,   // ← "Most popular" badge
    selfServe:   true,
    features: [
      'Full lesson library + answer keys',
      'In-context CPD modules',
      'Gradebook + auto-reports',
      'Curriculum-aligned pacing guide',
    ],
  },
  {
    code:        'school',
    label:       'Schools',
    featured:    false,
    selfServe:   false,  // ← shows "Talk to sales" only
    features: [
      'Up to 200 pupils included',
      'Full SIMS — attendance, scores, reports',
      'All staff accounts included',
      'Onboarding + teacher CPD included',
    ],
  },
];

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PricingPage() {
  const [track,   setTrack]   = useState('african'); // 'african' | 'international'
  const [cadence, setCadence] = useState('term');    // 'term'    | 'annual'
  const navigate = useNavigate();

  // ── Fetch tiers from DB ─────────────────────────────────────────────────
  // No auth required — public endpoint (RLS: active tiers readable by anon).
  // On failure, `data` will be undefined and we fall back to static prices.
  const {
    data:    dbTiers,
    isError: dbFailed,
    isLoading,
  } = useQuery({
    queryKey: ['public', 'tiers'],   // no curriculum filter — fetch all, filter client-side
    queryFn:  () => tiersService.listActiveTiers(),
    staleTime:          60_000,      // revalidate every 60s — price changes appear quickly
    refetchOnWindowFocus: true,      // always recheck when visitor returns to tab
    retry: 2,                        // try twice before falling back to static
  });

  // ── Normalise DB rows → shape used by PriceCard ──────────────────────────
  // DB shape:  { id, curriculum, audience, period, name, price_minor, currency,
  //             description, display_order }
  // Card shape: { code, track, audience, cadence, currency, amountMinor,
  //              label, saveHint? }
  const tiers = useMemo(() => {
    // If DB returned data: use it.
    if (dbTiers && dbTiers.length > 0) {
      return dbTiers.map((t) => ({
        // Map DB field names to the shape PriceCard expects.
        code:        derivePlanCode(t),   // e.g. 'AFR_PARENT_TERM'
        track:       t.curriculum,        // 'african' | 'foreign'
        audience:    t.audience,
        cadence:     t.period,            // DB calls it 'period', UI calls it 'cadence'
        currency:    t.currency,
        amountMinor: t.price_minor,
        label:       t.name,
        description: t.description ?? null,
        // Compute save hint: if annual, compare against 3× the term price.
        saveHint:    computeSaveHint(t, dbTiers),
        // Keep the raw DB id for future use.
        _dbId: t.id,
        _fromDb: true,
      }));
    }

    // Fall back to static config if DB failed or returned nothing.
    return Object.values(STATIC_PLANS).map((p) => ({ ...p, _fromDb: false }));
  }, [dbTiers]);

  // ── Filter to the card the user selected ─────────────────────────────────
  function tiersFor({ audience }) {
    // Exact match first.
    const matches = tiers.filter(
      (t) =>
        normaliseTrack(t.track) === track &&
        t.audience === audience &&
        t.cadence === cadence,
    );
    if (matches.length > 0) return matches;

    // Fall back to 'term' if no annual plan exists for this audience.
    return tiers.filter(
      (t) =>
        normaliseTrack(t.track) === track &&
        t.audience === audience &&
        t.cadence === 'term',
    );
  }

  const isUsingStaticFallback = dbFailed || (dbTiers && dbTiers.length === 0);

  return (
    <div className="min-h-dvh bg-surface-1 text-ink-1">
      <PublicNav />
      <main className="pt-[64px]">

        {/* Header */}
        <section className="border-b border-line-1">
          <div className="max-w-[1280px] mx-auto px-s-6 lg:px-s-9 py-s-10">
            <Chip variant="gold" dot>Pricing</Chip>
            <h1 className="mt-s-5 font-display text-display-1 text-ink-0">
              Pricing built for the way{' '}
              <span className="ital-gold">African families pay.</span>
            </h1>
            <p className="mt-s-5 text-body-l text-ink-2 max-w-[60ch]">
              African curriculum prices are denominated in Naira and stay
              fixed — no FX surprises. International curriculum prices are in
              US Dollars.
            </p>

            {/* Stale-fallback notice — small, non-alarmist */}
            {isUsingStaticFallback && !isLoading && (
              <p className="mt-s-4 font-mono text-[11px] text-ink-3">
                Prices shown are our published rates.
                {' '}
                <Link to="/contact" className="underline hover:text-ink-1">Contact us</Link>
                {' '}if you need the latest figures.
              </p>
            )}
          </div>
        </section>

        {/* Sticky toggles */}
        <section className="border-b border-line-1 py-s-7 sticky top-[64px] bg-surface-1/85 backdrop-blur-md z-40">
          <div className="max-w-[1280px] mx-auto px-s-6 lg:px-s-9 flex flex-wrap gap-s-5 items-center justify-between">
            <Toggle
              label="Curriculum"
              value={track}
              onChange={setTrack}
              options={[
                { code: 'african',       label: 'African curriculum'       },
                { code: 'international', label: 'International curriculum' },
              ]}
            />
            <Toggle
              label="Billing"
              value={cadence}
              onChange={setCadence}
              options={[
                { code: 'term',   label: 'Per term' },
                { code: 'annual', label: 'Annual'   },
              ]}
            />
          </div>
        </section>

        {/* Price cards */}
        <section className="py-s-10">
          <div className="max-w-[1280px] mx-auto px-s-6 lg:px-s-9">

            {isLoading ? (
              <CardSkeleton />
            ) : (
              <div className="grid md:grid-cols-3 gap-s-5">
                {AUDIENCES.map((aud) => {
                  const candidates = tiersFor({ audience: aud.code });
                  const tier = candidates[0];
                  if (!tier) return null;

                  const cadenceFallback =
                    cadence === 'annual' && tier.cadence === 'term';

                  return (
                    <PriceCard
                      key={aud.code}
                      tier={tier}
                      audienceMeta={aud}
                      cadenceFallback={cadenceFallback}
                      track={track}
                      onSubscribe={() => navigate(`/sign-up?plan=${tier.code}`)}
                    />
                  );
                })}
              </div>
            )}

            {/* FX disclaimer — African curriculum only, same as before */}
            {track === 'african' && !isLoading && (
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

// ── Price card ────────────────────────────────────────────────────────────────

function PriceCard({ tier, audienceMeta, cadenceFallback, track, onSubscribe }) {
  const isAnnual     = tier.cadence === 'annual';
  const isSchool     = audienceMeta.code === 'school';
  const prefix       = tier.currency === 'NGN' ? '₦' : '$';
  const formattedAmt = tiersService.formatPrice(tier.amountMinor, tier.currency);

  // USD equivalent under NGN prices (same logic as before, now uses DB amount)
  const usdEquiv = tier.currency === 'NGN' && tier.amountMinor
    ? `≈ $${(tier.amountMinor / 100 / FX.ngnPerUsd).toFixed(2)}`
    : null;

  return (
    <div className={cn(
      'rounded-r-4 p-s-7 flex flex-col gap-s-5 relative',
      audienceMeta.featured
        ? 'bg-surface-2 border-2 border-gold-400/50 shadow-gold'
        : 'bg-surface-2 border border-line-1',
    )}>

      {audienceMeta.featured && (
        <div className="absolute -top-[14px] left-s-7">
          <Chip variant="gold" dot>Most popular</Chip>
        </div>
      )}

      {/* Audience label */}
      <div className="font-mono text-eyebrow uppercase text-gold-400">
        {audienceMeta.label}
      </div>

      {/* Price */}
      <div>
        <div className="flex items-baseline gap-s-3 flex-wrap">
          <div className="font-display text-[44px] leading-none tracking-[-0.02em] text-ink-0">
            {prefix}{formattedAmt}
          </div>
          {usdEquiv && (
            <div className="font-mono text-meta text-ink-3">{usdEquiv}</div>
          )}
        </div>

        <div className="mt-s-2 font-mono text-meta text-ink-3">
          {isAnnual ? 'per year' : 'per term'}
          {tier.saveHint && isAnnual && (
            <span className="ml-s-3 text-gold-200">· {tier.saveHint}</span>
          )}
        </div>

        {cadenceFallback && (
          <div className="mt-s-2 font-mono text-[10px] text-ink-3 italic">
            Annual plan not available for this audience — showing term pricing.
          </div>
        )}

        {/* Optional description from DB */}
        {tier.description && (
          <p className="mt-s-3 text-[13px] text-ink-2">{tier.description}</p>
        )}
      </div>

      {/* Feature list */}
      <ul className="flex flex-col gap-s-3 text-[13.5px] text-ink-1 border-t border-line-1 pt-s-5">
        {audienceMeta.features.map((f) => (
          <li key={f} className="flex items-start gap-s-3">
            <CheckIcon />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      {/* CTAs */}
      <div className="mt-auto pt-s-3 flex flex-col gap-s-3">
        {audienceMeta.selfServe && !isSchool ? (
          <>
            <Button
              intent="primary"
              size="md"
              onClick={onSubscribe}
              className="w-full justify-center"
            >
              Subscribe
            </Button>
            <Link to="/solutions/schools" className="text-center">
              <Button intent="ghost" size="md" className="w-full justify-center">
                Talk to sales →
              </Button>
            </Link>
          </>
        ) : (
          // School plans: self-serve Paystack is inappropriate for a ₦61K+
          // enterprise product. Sales contact only.
          <>
            <Link to="/contact" className="text-center">
              <Button intent="primary" size="md" className="w-full justify-center">
                Talk to sales →
              </Button>
            </Link>
            <Link to="/solutions/schools" className="text-center">
              <Button intent="ghost" size="md" className="w-full justify-center">
                See what's included →
              </Button>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────

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

// ── Loading skeleton ──────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="grid md:grid-cols-3 gap-s-5">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="rounded-r-4 bg-surface-2 border border-line-1 h-[400px] animate-pulse"
        />
      ))}
    </div>
  );
}

// ── CheckIcon (unchanged) ─────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="mt-[3px] flex-shrink-0">
      <circle cx="12" cy="12" r="10" fill="rgba(229,166,42,.12)" stroke="rgba(229,166,42,.5)" strokeWidth="1" />
      <path d="M8 12.5l2.5 2.5L16 9" stroke="#e5a62a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── FAQ (unchanged from original) ─────────────────────────────────────────────

function FaqSection() {
  const faqs = [
    {
      q: 'Are NGN prices fixed?',
      a: 'Yes. African curriculum prices are denominated in Naira and stay fixed regardless of FX movement. The USD equivalent shown next to the NGN price is informational only.',
    },
    {
      q: 'Can I switch between term and annual billing?',
      a: "Yes — at any renewal point. We pro-rate intelligently so you never pay twice for the same period.",
    },
    {
      q: 'Do you support transfer or USSD?',
      a: "Yes. Paystack handles bank transfer, USSD, and card. You don't need a bank card to subscribe.",
    },
    {
      q: 'What happens if my school grows past 200 pupils?',
      a: "Talk to sales — we'll quote a custom enterprise tier. The platform is designed for school groups; we've worked with 6-school operators.",
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

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Reconstruct the canonical plan code from a DB tier row.
 * Mirrors the derivePlanCode() in parentSubscriptionService.js.
 *
 * DB stores: curriculum ('african'|'foreign'), audience, period ('term'|'annual')
 * Code shape: AFR_PARENT_TERM, INT_SCHOOL_ANNUAL, etc.
 */
function derivePlanCode(tier) {
  const prefix  = tier.curriculum === 'african' ? 'AFR' : 'INT';
  const aud     = tier.audience.toUpperCase();
  const cadence = tier.period === 'annual' ? 'ANNUAL' : 'TERM';
  return `${prefix}_${aud}_${cadence}`;
}

/**
 * "Save vs 3× term" hint for annual plans.
 * Computes the saving only if the same audience's term plan exists in the DB.
 */
function computeSaveHint(annualTier, allTiers) {
  if (annualTier.period !== 'annual') return undefined;

  const termTier = allTiers.find(
    (t) =>
      t.curriculum === annualTier.curriculum &&
      t.audience   === annualTier.audience   &&
      t.period     === 'term',
  );

  if (!termTier) return undefined;

  const threeTerms = termTier.price_minor * 3;
  const annual     = annualTier.price_minor;
  if (annual >= threeTerms) return undefined;  // no saving, no hint

  const savingMinor = threeTerms - annual;
  const prefix      = annualTier.currency === 'NGN' ? '₦' : '$';
  const savingMajor = Math.round(savingMinor / 100);
  const formattedSaving = savingMajor.toLocaleString(
    annualTier.currency === 'NGN' ? 'en-NG' : 'en-US',
  );
  return `Save ${prefix}${formattedSaving} vs 3× term`;
}

/**
 * DB stores curriculum as 'african' | 'foreign'.
 * Toggle state uses 'african' | 'international'.
 * Normalise so the filter works regardless of which side the mismatch is on.
 */
function normaliseTrack(dbTrack) {
  if (dbTrack === 'foreign') return 'international';
  return dbTrack; // 'african' is already correct
}
