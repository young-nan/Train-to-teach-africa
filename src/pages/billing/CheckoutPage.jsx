/**
 * src/pages/billing/CheckoutPage.jsx
 *
 * /billing/checkout?plan=PLAN_CODE
 *
 * The missing link between "Start Learning" CTAs and the Paystack redirect.
 * Previously, SignUpPage navigated here but the route didn't exist — every
 * pre-selected-plan signup hit a 404 immediately after account creation.
 *
 * WHAT THIS PAGE DOES
 * ────────────────────
 * 1. Reads `plan` from the query string.
 * 2. Validates it against PLANS — shows an error if unknown.
 * 3. Shows a clear summary: what they're buying, how much, for how long.
 * 4. "Proceed to payment" → calls initialisePayment → redirects to
 *    Paystack's hosted payment page.
 * 5. Paystack redirects to /billing/return?reference=xxx after payment.
 *    BillingReturnPage handles the webhook polling from there.
 *
 * DESIGN
 * ──────
 * Minimal. The parent has already decided to subscribe — they don't need
 * another marketing pitch here. They need:
 *   - Confirmation of what they picked
 *   - The exact amount they'll be charged
 *   - One button to proceed
 *   - A way back if they changed their mind
 *
 * No AppShell — this is a standalone page (same pattern as BillingReturnPage).
 */

import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { PLANS, formatPrice, formatUsdEquivalent } from '@/config/pricing';
import * as paymentService from '@/services/paymentService';
import { friendlyError } from '@/utils/friendlyError';

// ── Term / cadence labels ────────────────────────────────────────────────────

const CADENCE_LABEL = {
  term:   'one school term (~13 weeks)',
  annual: 'one academic year',
};

const CADENCE_RENEWS = {
  term:   'Renew each term.',
  annual: 'Renew annually.',
};

const TRACK_LABEL = {
  african:       'Nigerian / African Curriculum',
  international: 'International Curriculum',
};

const AUDIENCE_LABEL = {
  parent:  'Parent plan',
  teacher: 'Teacher plan',
  school:  'School bundle',
};

// ── Component ────────────────────────────────────────────────────────────────

export default function CheckoutPage() {
  const [params]   = useSearchParams();
  const navigate   = useNavigate();
  const { profile, role, user } = useAuth();

  const planCode = params.get('plan')?.toUpperCase();
  const tierId   = params.get('tier'); // UUID from new signup flow
  const plan     = planCode ? PLANS[planCode] : null;

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  // Fetch tier by UUID when coming from new signup flow
  const { data: tierRow } = useQuery({
    queryKey: ['checkout-tier', tierId],
    queryFn: async () => {
      if (!tierId) return null;
      const { data, error } = await supabase
        .from('subscription_tiers')
        .select('*')
        .eq('id', tierId)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!tierId && !plan,
    staleTime: Infinity,
  });

  // If we have a tier UUID, synthesise a plan-like object
  const activePlan = plan ?? (tierRow ? {
    name:        tierRow.name,
    audience:    tierRow.audience,
    period:      tierRow.period,
    price_minor: tierRow.price_minor,
    currency:    tierRow.currency,
    tier_id:     tierRow.id,
  } : null);

  // ── Loading tier by UUID ───────────────────────────────────────────────────
  if (tierId && !activePlan) {
    return (
      <CheckoutShell>
        <div className="text-center py-s-10">
          <div className="w-8 h-8 border-2 border-gold-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-s-4 text-body text-ink-3">Loading plan details…</p>
        </div>
      </CheckoutShell>
    );
  }

  // ── Unknown plan ──────────────────────────────────────────────────────────
  if (!activePlan && !tierId) {
    return (
      <CheckoutShell>
        <div className="text-center">
          <Chip variant="red" dot>Plan not found</Chip>
          <h1 className="mt-s-5 font-display text-display-2 text-ink-0">
            Unknown plan.
          </h1>
          <p className="mt-s-4 text-body text-ink-2 max-w-[46ch] mx-auto">
            The plan code "{params.get('plan')}" isn't valid. Please go back
            to the pricing page and choose a plan.
          </p>
          <div className="mt-s-7">
            <Link to="/pricing">
              <Button intent="primary" size="md">View pricing →</Button>
            </Link>
          </div>
        </div>
      </CheckoutShell>
    );
  }

  // ── School plans — not self-serve ─────────────────────────────────────────
  if (activePlan?.audience === 'school') {
    return (
      <CheckoutShell>
        <div className="text-center">
          <Chip variant="gold" dot>School plan</Chip>
          <h1 className="mt-s-5 font-display text-display-2 text-ink-0">
            Talk to us first.
          </h1>
          <p className="mt-s-4 text-body text-ink-2 max-w-[50ch] mx-auto">
            School bundles are set up with a brief onboarding call so we can
            configure your account correctly. It takes 30 minutes.
          </p>
          <div className="mt-s-7 flex flex-wrap justify-center gap-s-4">
            <a href="mailto:support@traintoteachafrica.org?subject=School%20bundle%20enquiry">
              <Button intent="primary" size="md">Email us →</Button>
            </a>
            <Link to="/pricing">
              <Button intent="ghost" size="md">Back to pricing</Button>
            </Link>
          </div>
        </div>
      </CheckoutShell>
    );
  }

  // ── Normal payment flow ───────────────────────────────────────────────────
  const handlePay = async () => {
    setError(null);
    setLoading(true);
    try {
      const email = profile?.email ?? user?.email;
      if (!email) throw new Error('Could not find your email address. Please sign in again.');

      const result = await paymentService.initialisePayment({
        planCode,
        customerEmail: email,
        metadata: {
          tta_user_id: user?.id,
          plan_code:   planCode,
          audience:    activePlan.audience,
          track:       plan.track,
        },
      });

      if (result.authorization_url) {
        // Paystack hosted page — user completes payment there, redirected
        // back to /billing/return?reference=xxx
        window.location.href = result.authorization_url;
      } else {
        throw new Error('No payment URL returned. Please try again.');
      }
    } catch (e) {
      setError(friendlyError(e));
      setLoading(false);
    }
  };

  const usdEquiv = formatUsdEquivalent(planCode);

  return (
    <CheckoutShell>
      {/* Not signed in — prompt first */}
      {!user && (
        <div className="mb-s-6 p-s-4 bg-amber-400/[0.06] border border-amber-400/25 rounded-r-2">
          <p className="text-[13.5px] text-ink-2">
            Please{' '}
            <Link to={`/sign-in?next=/billing/checkout?plan=${planCode}`} className="text-gold-400 underline">
              sign in
            </Link>{' '}
            or{' '}
            <Link to={`/sign-up?plan=${planCode}`} className="text-gold-400 underline">
              create an account
            </Link>{' '}
            before subscribing.
          </p>
        </div>
      )}

      {/* Plan summary card */}
      <Card className="bg-surface-2 border-line-2 mb-s-5">
        <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-4">
          Order summary
        </div>

        <div className="flex items-start justify-between gap-s-4 flex-wrap">
          <div>
            <div className="font-display text-display-3 text-ink-0">{plan.label}</div>
            <div className="mt-s-2 font-mono text-meta text-ink-3">
              {AUDIENCE_LABEL[activePlan.audience]} · {TRACK_LABEL[plan.track]}
            </div>
          </div>
          <div className="text-right">
            <div className="font-display text-[32px] leading-none text-ink-0">
              {formatPrice(planCode)}
            </div>
            {usdEquiv && (
              <div className="mt-s-1 font-mono text-meta text-ink-3">
                ≈ {usdEquiv} at today's rate
              </div>
            )}
          </div>
        </div>

        <div className="mt-s-5 pt-s-5 border-t border-line-1 space-y-s-2">
          <Row label="Duration"  value={CADENCE_LABEL[plan.cadence]  ?? plan.cadence} />
          <Row label="Renewal"   value={CADENCE_RENEWS[plan.cadence] ?? '—'} />
          <Row label="Charged"   value={`${formatPrice(planCode)} by Paystack`} />
          <Row label="Includes"  value="All TTA Learn features for your child(ren)" />
        </div>
      </Card>

      {/* Paystack trust strip */}
      <div className="flex items-center gap-s-2 mb-s-6 font-mono text-[11px] text-ink-3">
        <LockIcon />
        <span>Secured by Paystack · Your card details never touch our servers</span>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-s-5 text-[13px] text-red-400 bg-red-400/10 border border-red-400/30 rounded-r-2 px-s-4 py-s-3">
          {error}
        </div>
      )}

      {/* CTA */}
      <div className="flex flex-col sm:flex-row gap-s-4">
        <Button
          intent="primary"
          size="lg"
          onClick={handlePay}
          isLoading={loading}
          disabled={!user}
          className="flex-1 justify-center"
        >
          Pay {formatPrice(planCode)} →
        </Button>
        <Link to="/pricing" className="flex-1">
          <Button intent="ghost" size="lg" className="w-full justify-center">
            Back to pricing
          </Button>
        </Link>
      </div>

      <p className="mt-s-5 text-[12px] text-ink-3 text-center max-w-[52ch] mx-auto">
        By proceeding you agree to TTA's terms of service. Cancel or change your
        plan at any time from your account settings.
      </p>
    </CheckoutShell>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function CheckoutShell({ children }) {
  return (
    <div className="min-h-dvh bg-surface-1 grid place-items-center px-s-5 py-s-10">
      <div className="max-w-[540px] w-full">
        {/* Back link */}
        <Link to="/" className="inline-flex items-center gap-s-2 mb-s-7 font-mono text-meta text-ink-3 hover:text-ink-1">
          <span>←</span>
          <span>Train To Teach Africa</span>
        </Link>
        {children}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between text-[13.5px]">
      <span className="text-ink-3">{label}</span>
      <span className="text-ink-1 text-right max-w-[60%]">{value}</span>
    </div>
  );
}

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="4" y="9" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 9V7a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
