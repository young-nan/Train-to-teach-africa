/**
 * src/modules/parent/ParentSubscribeView.jsx
 *
 * /app/parent/subscribe
 *
 * Parent picks a subscription tier. Filters: African vs Foreign curriculum.
 * On tier select → kicks off Paystack flow → browser redirects → callback
 * returns to /app/parent/subscribe/return where we verify and confirm.
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
  const [curriculum, setCurriculum] = useState('african');
  const [childrenCovered, setChildrenCovered] = useState(1);

  const { data: tiers, isLoading } = useQuery({
    queryKey: ['parent', 'tiers', curriculum],
    queryFn: () => tiersService.listActiveTiers({ curriculum }),
    staleTime: 5 * 60_000,
  });

  // Only show 'parent' audience tiers — schools and teachers subscribe elsewhere
  const parentTiers = (tiers ?? []).filter((t) => t.audience === 'parent');

  const { data: currentEntitlement } = useQuery({
    queryKey: ['parent', 'entitlement'],
    queryFn: () => parentSubscriptionService.getEntitlement(),
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

      {currentEntitlement && (
        <Card className="mb-s-5 border-green-400/30 bg-green-400/[0.04]">
          <div className="flex items-center gap-s-3">
            <Chip variant="green" dot>Active</Chip>
            <span className="text-[13.5px] text-ink-1">
              You're already subscribed to <strong>{currentEntitlement.tier_name}</strong>.
              Valid for <strong>{currentEntitlement.days_remaining} more days</strong>.
            </span>
          </div>
        </Card>
      )}

      {/* Curriculum toggle */}
      <div className="mb-s-5 flex items-center gap-s-3">
        <span className="font-mono text-eyebrow uppercase text-ink-3">Curriculum</span>
        {[
          { value: 'african', label: 'African (NERDC)' },
          { value: 'foreign', label: 'Foreign (Cambridge / IB)' },
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

      {/* Children-covered selector */}
      <Card className="mb-s-5">
        <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-3">How many children?</div>
        <p className="text-[13px] text-ink-2 mb-s-4">
          One subscription can cover multiple children at the same school level.
          You'll enrol their details after payment.
        </p>
        <div className="flex items-center gap-s-3">
          <button
            type="button"
            onClick={() => setChildrenCovered((n) => Math.max(1, n - 1))}
            className="w-[40px] h-[40px] bg-surface-3 border border-line-2 rounded-r-2 text-ink-1 hover:border-gold-400/40"
            aria-label="Decrease"
          >
            −
          </button>
          <span className="font-display text-display-3 text-ink-0 tabular-nums w-[40px] text-center">
            {childrenCovered}
          </span>
          <button
            type="button"
            onClick={() => setChildrenCovered((n) => Math.min(6, n + 1))}
            className="w-[40px] h-[40px] bg-surface-3 border border-line-2 rounded-r-2 text-ink-1 hover:border-gold-400/40"
            aria-label="Increase"
          >
            +
          </button>
        </div>
      </Card>

      {isLoading && (
        <div className="grid sm:grid-cols-2 gap-s-4">
          {[0, 1].map((i) => (
            <div key={i} className="bg-surface-2 border border-line-1 rounded-r-3 h-[200px] animate-pulse" />
          ))}
        </div>
      )}

      {parentTiers.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-s-4">
          {parentTiers.map((tier) => (
            <TierCard key={tier.id} tier={tier} childrenCovered={childrenCovered} />
          ))}
        </div>
      )}
    </div>
  );
}

function TierCard({ tier, childrenCovered }) {
  const subscribe = useMutation({
    mutationFn: () => parentSubscriptionService.startSubscribe({ tier, childrenCovered }),
    onSuccess: (result) => {
      // Redirect browser to Paystack
      if (result.authorization_url) {
        window.location.href = result.authorization_url;
      }
    },
  });

  return (
    <Card className="hover:border-gold-400/40 transition-colors">
      <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-3">
        {tier.period === 'annual' ? 'Best value · Annual' : 'Single term'}
      </div>
      <h3 className="font-display text-display-3 text-ink-0">{tier.name}</h3>
      <div className="mt-s-4 font-display text-display-2 text-ink-0 tabular-nums">
        {CURRENCY_PREFIX[tier.currency]}{tiersService.formatPrice(tier.price_minor, tier.currency)}
      </div>
      <div className="font-mono text-meta text-ink-3 mt-s-1">
        per {tier.period === 'annual' ? 'year' : 'term'} · {childrenCovered} {childrenCovered === 1 ? 'child' : 'children'}
      </div>

      {tier.description && (
        <p className="mt-s-4 text-[13px] text-ink-2">{tier.description}</p>
      )}

      {subscribe.error && (
        <div className="mt-s-3 text-[12.5px] text-red-400">{friendlyError(subscribe.error)}</div>
      )}

      <Button
        intent="primary"
        size="md"
        onClick={() => subscribe.mutate()}
        isLoading={subscribe.isPending}
        className="w-full justify-center mt-s-5"
      >
        Subscribe →
      </Button>
    </Card>
  );
}
