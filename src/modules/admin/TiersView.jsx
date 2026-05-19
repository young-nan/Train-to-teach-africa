/**
 * src/modules/admin/TiersView.jsx
 *
 * /app/admin/tiers
 *
 * Super-admin only. Lists all subscription tiers (active and inactive),
 * lets the admin edit price, name, description, active flag, and
 * Paystack plan code.
 *
 * The (curriculum × audience × period) identity is fixed — you can't
 * change a tier's structural identity, only its display/price details.
 * Adding new tiers requires a migration (rare event).
 *
 * Edits are inline: click a tier row to open an edit form below it.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import * as tiersService from '@/services/tiersService';
import { cn } from '@/utils/cn';

const CURRENCY_PREFIX = { NGN: '₦', USD: '$' };

export function TiersView() {
  const { profile } = useAuth();

  // Hooks must run on every render in the same order. Place useQuery
  // BEFORE the role-gated early return; `enabled` keeps the query inert
  // for non-super-admins so we don't fire a useless network call.
  const isSuperAdmin = profile?.role === 'super_admin';
  const { data: tiers, isLoading } = useQuery({
    queryKey: ['admin', 'tiers'],
    queryFn: () => tiersService.listAllTiers(),
    enabled: isSuperAdmin,
    staleTime: 30_000,
  });

  if (!isSuperAdmin) {
    return (
      <Card className="border-amber-400/30 bg-amber-400/[0.04]">
        <div className="font-display text-display-3 text-amber-400">Super admin only</div>
        <p className="mt-s-3 text-body text-ink-2">
          Subscription tier editing is restricted to super admins. If you
          need a price changed, contact your TTA administrator.
        </p>
      </Card>
    );
  }

  return (
    <div className="max-w-[820px]">
      <div className="mb-s-7">
        <div className="font-mono text-eyebrow uppercase text-gold-400">Subscription tiers</div>
        <h2 className="mt-s-3 font-display text-display-2 text-ink-0">
          Pricing and curriculum tiers.
        </h2>
        <p className="mt-s-3 text-body text-ink-2 max-w-[58ch]">
          What TTA charges per audience, curriculum, and billing period.
          Edits go live immediately on the public pricing page.
        </p>
      </div>

      {isLoading && <Skeleton />}

      {tiers && (
        <div className="space-y-s-7">
          <TierGroup
            title="African Curriculum"
            tiers={tiers.filter((t) => t.curriculum === 'african')}
          />
          <TierGroup
            title="Foreign Curriculum"
            tiers={tiers.filter((t) => t.curriculum === 'foreign')}
          />
        </div>
      )}
    </div>
  );
}

function TierGroup({ title, tiers }) {
  return (
    <section>
      <h3 className="font-display text-display-3 text-ink-0 mb-s-4">{title}</h3>
      <div className="bg-surface-2 border border-line-1 rounded-r-3 overflow-hidden">
        {tiers.map((t) => (
          <TierRow key={t.id} tier={t} />
        ))}
      </div>
    </section>
  );
}

function TierRow({ tier }) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="border-b border-line-1 last:border-0">
      <button
        type="button"
        onClick={() => setEditing((v) => !v)}
        className="w-full text-left flex items-center gap-s-4 px-s-4 py-s-3 min-h-[64px] hover:bg-surface-3 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="text-[14.5px] text-ink-1 truncate">{tier.name}</div>
          <div className="font-mono text-[10px] text-ink-3 uppercase tracking-wide">
            {tier.audience} · {tier.period}
          </div>
        </div>
        <div className="font-mono text-[15px] text-ink-0 tabular-nums">
          {CURRENCY_PREFIX[tier.currency]}{tiersService.formatPrice(tier.price_minor, tier.currency)}
        </div>
        <Chip variant={tier.active ? 'green' : 'default'} dot={tier.active}>
          {tier.active ? 'Active' : 'Hidden'}
        </Chip>
      </button>
      {editing && (
        <TierEditPanel tier={tier} onClose={() => setEditing(false)} />
      )}
    </div>
  );
}

function TierEditPanel({ tier, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: tier.name,
    // Edit as major-unit decimal — admins think in whole naira/dollars
    price_major: tier.currency === 'USD'
      ? (tier.price_minor / 100).toFixed(2)
      : Math.round(tier.price_minor / 100).toString(),
    description: tier.description ?? '',
    paystack_plan_code: tier.paystack_plan_code ?? '',
    active: tier.active,
  });
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: () => {
      const priceMajor = parseFloat(form.price_major);
      if (Number.isNaN(priceMajor) || priceMajor < 0) {
        throw new Error('Price must be a positive number.');
      }
      // Convert back to minor units for storage. Round to handle USD cents.
      const priceMinor = Math.round(priceMajor * 100);
      return tiersService.updateTier({
        id: tier.id,
        patch: {
          name: form.name.trim(),
          price_minor: priceMinor,
          description: form.description.trim() || null,
          paystack_plan_code: form.paystack_plan_code.trim() || null,
          active: form.active,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'tiers'] });
      qc.invalidateQueries({ queryKey: ['public', 'tiers'] }); // busts PricingPage cache
      onClose();
    },
  });

  return (
    <div className="px-s-4 pb-s-4 pt-s-2 bg-surface-3/30 border-t border-line-1">
      <form
        onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
        className="grid sm:grid-cols-2 gap-s-4"
      >
        <Field label="Display name *">
          <input
            type="text" value={form.name} required
            onChange={(e) => update('name', e.target.value)}
            className="bg-surface-2 border border-line-2 rounded-r-2 px-s-3 py-s-2 text-[14px] text-ink-1 outline-none focus:border-gold-400"
          />
        </Field>
        <Field
          label={`Price (${tier.currency === 'USD' ? '$' : '₦'}) *`}
          hint={tier.currency === 'USD' ? 'Decimals allowed (e.g. 12.50)' : 'Whole naira (e.g. 10847)'}
        >
          <input
            type="number"
            step={tier.currency === 'USD' ? '0.01' : '1'}
            min="0"
            value={form.price_major} required
            onChange={(e) => update('price_major', e.target.value)}
            className="bg-surface-2 border border-line-2 rounded-r-2 px-s-3 py-s-2 text-[14px] font-mono text-ink-1 outline-none focus:border-gold-400"
          />
        </Field>
        <Field label="Description" hint="Optional. Marketing copy.">
          <textarea
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            rows={2}
            className="bg-surface-2 border border-line-2 rounded-r-2 px-s-3 py-s-2 text-[13px] text-ink-1 outline-none focus:border-gold-400 resize-none"
          />
        </Field>
        <Field label="Paystack plan code" hint="Optional. For recurring subscriptions.">
          <input
            type="text" value={form.paystack_plan_code}
            onChange={(e) => update('paystack_plan_code', e.target.value)}
            placeholder="PLN_..."
            className="bg-surface-2 border border-line-2 rounded-r-2 px-s-3 py-s-2 text-[13px] font-mono text-ink-1 outline-none focus:border-gold-400"
          />
        </Field>
        <Field label="Visibility">
          <label className="flex items-center gap-s-3 cursor-pointer">
            <input
              type="checkbox" checked={form.active}
              onChange={(e) => update('active', e.target.checked)}
              className="accent-gold-400 w-[16px] h-[16px]"
            />
            <span className="text-[13.5px] text-ink-1">Visible on pricing page</span>
          </label>
        </Field>
        <div className="sm:col-span-2 flex justify-end gap-s-3 pt-s-2">
          {save.error && (
            <span className="text-[12.5px] text-red-400 mr-auto self-center">{save.error.message}</span>
          )}
          <Button intent="ghost" size="md" type="button" onClick={onClose}>Cancel</Button>
          <Button intent="primary" size="md" type="submit" isLoading={save.isPending}>
            Save changes
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="flex flex-col gap-s-1">
      <span className="font-mono text-meta uppercase tracking-[0.14em] text-ink-3">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-ink-3 italic">{hint}</span>}
    </label>
  );
}

function Skeleton() {
  return (
    <div className="space-y-s-5">
      {[0, 1].map((i) => (
        <div key={i} className="bg-surface-2 border border-line-1 rounded-r-3 h-[200px] animate-pulse" />
      ))}
    </div>
  );
}
