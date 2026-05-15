/**
 * src/modules/parent/ParentSubscribeView.jsx
 *
 * /app/parent/subscribe
 *
 * FIXES IN THIS VERSION
 * ─────────────────────
 * 1. PRICES COME FROM THE DATABASE — not from pricing.js hardcoded values.
 *    tiersService.listActiveTiers() fetches subscription_tiers from Supabase.
 *    When super admin changes a price in TiersView, it updates the DB row.
 *    This view reads that DB row. The pricing page now stays in sync automatically.
 *
 * 2. PRICE MULTIPLIED BY CHILDREN COUNT — when a parent selects 3 children,
 *    the displayed price and the Paystack charge are both multiplied by 3.
 *    The total is shown prominently before the Subscribe button.
 *    The childrenCovered value is passed to startSubscribe() which stores
 *    it on the parent_subscriptions row.
 *
 * 3. PER-CHILD PRICE SHOWN — each tier card shows the per-child price clearly
 *    and recalculates the total live as the stepper changes.
 */

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import * as tiersService from '@/services/tiersService';
import * as parentSubscriptionService from '@/services/parentSubscriptionService';
import { friendlyError } from '@/utils/friendlyError';
import { cn } from '@/utils/cn';

const CURRENCY_PREFIX = { NGN: '₦', USD: '$' };

export function ParentSubscribeView() {
  const [curriculum,      setCurriculum]      = useState('african');
  const [childrenCovered, setChildrenCovered] = useState(1);

  // ── Fetch active tiers from DB (NOT from pricing.js) ─────────────────────
  // This is the fix: prices come from subscription_tiers table which the
  // super admin can edit via TiersView. Any price change in the admin
  // dashboard immediately reflects here on next query refresh.
  const { data: tiers, isLoading } = useQuery({
    queryKey: ['parent', 'tiers', curriculum],
    queryFn:  () => tiersService.listActiveTiers({ curriculum }),
    staleTime: 60_000,   // revalidate after 1 minute so price changes appear quickly
    refetchOnWindowFocus: true,  // always recheck when tab refocuses
  });

  // Only show parent-audience tiers on this screen.
  const parentTiers = (tiers ?? []).filter((t) => t.audience === 'parent');

  const { data: currentEntitlement } = useQuery({
    queryKey: ['parent', 'entitlement'],
    queryFn:  () => parentSubscriptionService.getEntitlement(),
    staleTime: 30_000,
  });

  return (
    <div className="max-w-[820px]">
      <div className="mb-s-5">
        <Link to="/app/parent" className="text-[13.5px] text-ink-3 hover:text-ink-1">← Tonight</Link>
      </div>

      <div className="mb-s-7">
        <div className="font-mono text-eyebrow uppercase text-gold-400">Subscribe</div>
        <h2 className="mt-s-3 font-display text-display-2 text-ink-0">
          Unlock daily lessons.
        </h2>
        <p className="mt-s-3 text-body text-ink-2 max-w-[58ch]">
          Subscribed parents get personalised lesson PDFs each term,
          nightly 5-minute kitchen activities, and printable home practice.
        </p>
      </div>

      {/* Active subscription banner */}
      {currentEntitlement && (
        <Card className="mb-s-5 border-green-400/30 bg-green-400/[0.04]">
          <div className="flex items-center gap-s-3">
            <Chip variant="green" dot>Active</Chip>
            <span className="text-[13.5px] text-ink-1">
              You're subscribed to <strong>{currentEntitlement.tier_name}</strong>.
              Valid for <strong>{currentEntitlement.days_remaining} more days</strong>.
            </span>
          </div>
          <p className="mt-s-3 text-[12.5px] text-ink-3">
            You can subscribe again below to extend your access or add more children.
          </p>
        </Card>
      )}

      {/* Curriculum toggle */}
      <div className="mb-s-5 flex items-center gap-s-3 flex-wrap">
        <span className="font-mono text-eyebrow uppercase text-ink-3">Curriculum</span>
        {[
          { value: 'african',  label: 'African (NERDC)' },
          { value: 'foreign',  label: 'Foreign (Cambridge / IB)' },
        ].map((opt) => (
          <button
            key={opt.value}
            onClick={() => setCurriculum(opt.value)}
            className={cn(
              'px-s-4 py-[7px] rounded-full text-[12.5px] font-medium border transition-all',
              curriculum === opt.value
                ? 'bg-gold-400 text-[#1a1305] border-gold-400'
                : 'bg-surface-2 text-ink-2 border-line-2 hover:border-line-3',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Children count stepper */}
      <Card className="mb-s-6 bg-surface-2 border-line-2">
        <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-3">
          How many children?
        </div>
        <p className="text-[13px] text-ink-2 mb-s-4">
          One subscription covers multiple children. The total price scales with your selection.
        </p>
        <div className="flex items-center gap-s-5">
          <div className="flex items-center gap-s-3">
            <button
              type="button"
              onClick={() => setChildrenCovered((n) => Math.max(1, n - 1))}
              className="w-[44px] h-[44px] bg-surface-3 border border-line-2 rounded-r-2 text-xl text-ink-1 hover:border-gold-400/60 transition-colors"
              aria-label="Remove one child"
            >
              −
            </button>
            <span className="font-display text-display-2 text-ink-0 tabular-nums w-[50px] text-center">
              {childrenCovered}
            </span>
            <button
              type="button"
              onClick={() => setChildrenCovered((n) => Math.min(6, n + 1))}
              className="w-[44px] h-[44px] bg-surface-3 border border-line-2 rounded-r-2 text-xl text-ink-1 hover:border-gold-400/60 transition-colors"
              aria-label="Add one child"
            >
              +
            </button>
          </div>
          <div className="text-body text-ink-2">
            {childrenCovered === 1
              ? 'Single child — standard price'
              : `${childrenCovered} children — price × ${childrenCovered}`}
          </div>
        </div>
      </Card>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="grid sm:grid-cols-2 gap-s-4">
          {[0, 1].map((i) => (
            <div key={i} className="bg-surface-2 border border-line-1 rounded-r-3 h-[220px] animate-pulse" />
          ))}
        </div>
      )}

      {/* Tier cards — prices from DB, multiplied by childrenCovered */}
      {!isLoading && parentTiers.length === 0 && (
        <Card className="bg-surface-2 border-line-2">
          <p className="text-body text-ink-2">
            No subscription plans available right now. Please check back soon.
          </p>
        </Card>
      )}

      {!isLoading && parentTiers.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-s-4">
          {parentTiers.map((tier) => (
            <TierCard
              key={tier.id}
              tier={tier}
              childrenCovered={childrenCovered}
            />
          ))}
        </div>
      )}

      {/* Pricing transparency note */}
      <div className="mt-s-7 p-s-4 bg-surface-2 border border-line-2 rounded-r-2">
        <p className="font-mono text-meta text-ink-3">
          Prices shown are in {curriculum === 'african' ? 'Nigerian Naira (₦)' : 'US Dollars ($)'}
          and are charged exactly as displayed. No hidden fees.
          All payments processed securely via Paystack.
        </p>
      </div>
    </div>
  );
}

// ── Tier card ─────────────────────────────────────────────────────────────────

function TierCard({ tier, childrenCovered }) {
  // Price per child (from DB) × number of children selected
  // This is the fix: we multiply BEFORE displaying AND before charging.
  const pricePerChild   = tier.price_minor;          // minor units from DB
  const totalPriceMinor = pricePerChild * childrenCovered;

  const prefix = CURRENCY_PREFIX[tier.currency] ?? '₦';

  // Format for display — uses tiersService.formatPrice which understands
  // NGN (no decimals) vs USD (2 decimals).
  const perChildDisplay = `${prefix}${tiersService.formatPrice(pricePerChild, tier.currency)}`;
  const totalDisplay    = `${prefix}${tiersService.formatPrice(totalPriceMinor, tier.currency)}`;

  const isAnnual = tier.period === 'annual';

  const subscribe = useMutation({
    mutationFn: () => parentSubscriptionService.startSubscribe({
      tier,
      childrenCovered,
      // Pass the computed total so startSubscribe can use it for the
      // pending_payment row (the edge function re-validates server-side).
      totalMinorOverride: totalPriceMinor,
    }),
    onSuccess: (result) => {
      if (result.authorization_url) {
        window.location.href = result.authorization_url;
      }
    },
  });

  return (
    <Card className={cn(
      'hover:border-gold-400/40 transition-colors flex flex-col',
      isAnnual && 'border-gold-400/25',
    )}>
      {/* Badge */}
      <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-3">
        {isAnnual ? 'Best value · Annual' : 'Single term'}
      </div>

      {/* Tier name */}
      <h3 className="font-display text-display-3 text-ink-0">{tier.name}</h3>

      {/* Description if present */}
      {tier.description && (
        <p className="mt-s-2 text-[12.5px] text-ink-2">{tier.description}</p>
      )}

      {/* Per-child price (base rate) */}
      <div className="mt-s-5">
        <div className="font-mono text-eyebrow uppercase text-ink-3 mb-s-1">
          Per child · per {isAnnual ? 'year' : 'term'}
        </div>
        <div className="font-display text-display-3 text-ink-2 tabular-nums">
          {perChildDisplay}
        </div>
      </div>

      {/* Divider */}
      <div className="my-s-4 border-t border-line-2" />

      {/* Total — this is what the parent pays */}
      <div>
        <div className="font-mono text-eyebrow uppercase text-ink-3 mb-s-1">
          Total for {childrenCovered} {childrenCovered === 1 ? 'child' : 'children'}
        </div>
        <div className="font-display text-display-2 text-ink-0 tabular-nums">
          {totalDisplay}
        </div>
        {childrenCovered > 1 && (
          <div className="font-mono text-meta text-ink-3 mt-s-1">
            = {perChildDisplay} × {childrenCovered}
          </div>
        )}
      </div>

      {/* Error */}
      {subscribe.error && (
        <div className="mt-s-3 text-[12.5px] text-red-400 bg-red-400/10 border border-red-400/30 rounded-r-1 px-s-3 py-s-2">
          {friendlyError(subscribe.error)}
        </div>
      )}

      {/* CTA */}
      <Button
        intent="primary"
        size="md"
        onClick={() => subscribe.mutate()}
        isLoading={subscribe.isPending}
        className="w-full justify-center mt-s-5"
      >
        Subscribe — {totalDisplay}
      </Button>

      <p className="mt-s-3 font-mono text-[10.5px] text-ink-3 text-center">
        Secured by Paystack · Cancel anytime
      </p>
    </Card>
  );
}
