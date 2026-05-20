/**
 * src/modules/teacher/TeacherSubscribeView.jsx
 *
 * /app/teacher/subscribe
 *
 * Shown to teachers who signed up independently (school_id = null)
 * and haven't subscribed yet.
 *
 * FREE TIER — visible without payment:
 *   • 3 random demo lessons (read-only preview)
 *   • Sample attendance sheet mock
 *   • Sample report card template
 *
 * PREMIUM — unlocked after subscription:
 *   • Full lesson library
 *   • Create classes and enrol pupils
 *   • Attendance marking and tracking
 *   • Gradebook and score entry
 *   • Term reports and approval flow
 *   • Intervention tracking
 *   • Parent communications
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import * as teacherSubService from '@/services/teacherSubscriptionService';
import { cn } from '@/utils/cn';

const NAV = [
  { to: '/app/teacher',             label: 'Dashboard', end: true },
  { to: '/app/teacher/subscribe',   label: 'Subscribe'            },
];

export function TeacherSubscribeView() {
  const { profile } = useAuth();
  const navigate    = useNavigate();
  const [currency,   setCurrency]   = useState('NGN');
  const [loading,    setLoading]    = useState(null); // tier_id being processed
  const [error,      setError]      = useState(null);

  // Fetch teacher subscription tiers
  const { data: tiers } = useQuery({
    queryKey: ['teacher-tiers', currency],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscription_tiers')
        .select('*')
        .eq('audience', 'teacher')
        .eq('currency', currency)
        .eq('active', true)
        .order('price_minor');
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    staleTime: 60_000,
  });

  // Fetch demo lessons for free preview
  const { data: demoLessons } = useQuery({
    queryKey: ['demo-lessons'],
    queryFn:  () => teacherSubService.getDemoLessons('african'),
    staleTime: 300_000,
  });

  const fmtPrice = (minor, curr) =>
    curr === 'NGN'
      ? `₦${(minor / 100).toLocaleString('en-NG')}`
      : `$${(minor / 100).toFixed(2)}`;

  const handleSubscribe = async (tier) => {
    setError(null);
    setLoading(tier.id);
    try {
      const { authorizationUrl } = await teacherSubService.startTeacherSubscription({
        tierId:     tier.id,
        curriculum: tier.curriculum,
      });
      window.location.href = authorizationUrl;
    } catch (e) {
      setError(e.message);
      setLoading(null);
    }
  };

  return (
    <AppShell title="Subscribe" navItems={NAV}>
      <div className="max-w-[860px]">
        <div className="mb-s-8">
          <Chip variant="gold" dot>Solo Teacher Plan</Chip>
          <h2 className="mt-s-4 font-display text-display-1 text-ink-0">
            Your classroom,<br />your subscription.
          </h2>
          <p className="mt-s-4 text-body-l text-ink-2 max-w-[56ch]">
            Subscribe to get your own private classroom. Enrol pupils, mark attendance,
            enter grades, generate report cards, and communicate with parents — all
            without needing a school IT admin.
          </p>
        </div>

        {/* What you get */}
        <div className="grid sm:grid-cols-2 gap-s-4 mb-s-8">
          {[
            { icon: '📚', title: 'Full lesson library',   body: 'All curriculum-aligned lessons across Nursery through SSS3.' },
            { icon: '📋', title: 'Attendance tracking',   body: 'Mark, view, and export attendance for all your classes.' },
            { icon: '📊', title: 'Gradebook',             body: 'Enter scores, auto-calculate averages, track trends.' },
            { icon: '📄', title: 'Report cards',          body: 'Generate, print, and share professional term reports.' },
            { icon: '💬', title: 'Parent communications', body: 'Send notes, share reports, and track parent engagement.' },
            { icon: '🚨', title: 'Interventions',         body: 'Flag at-risk pupils and track support actions.' },
          ].map(({ icon, title, body }) => (
            <div key={title} className="flex gap-s-3 bg-surface-2 border border-line-1 rounded-r-2 p-s-4">
              <span className="text-[20px] shrink-0">{icon}</span>
              <div>
                <div className="text-[14px] font-medium text-ink-0">{title}</div>
                <div className="text-[12px] text-ink-3 mt-[2px]">{body}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Currency toggle */}
        <div className="flex items-center gap-s-3 mb-s-5">
          <span className="font-mono text-[13px] text-ink-3">Currency:</span>
          {['NGN', 'USD'].map((c) => (
            <button key={c} onClick={() => setCurrency(c)}
              className={cn(
                'px-s-4 py-[5px] rounded-full font-mono text-[12px] border transition-all',
                currency === c
                  ? 'bg-gold-400/20 border-gold-400/40 text-gold-200'
                  : 'bg-surface-2 border-line-2 text-ink-3',
              )}>
              {c}
            </button>
          ))}
        </div>

        {/* Tier cards */}
        <div className="grid sm:grid-cols-2 gap-s-4 mb-s-6">
          {(tiers ?? []).map((tier) => (
            <Card key={tier.id} className={cn(
              'bg-surface-2 border',
              tier.period === 'annual' ? 'border-gold-400/40' : 'border-line-2',
            )}>
              {tier.period === 'annual' && (
                <div className="mb-s-3"><Chip variant="gold" size="sm">Best value · save ~20%</Chip></div>
              )}
              <div className="font-display text-[22px] text-ink-0">
                {fmtPrice(tier.price_minor, tier.currency)}
              </div>
              <div className="font-mono text-meta text-ink-3 mt-s-1">
                per {tier.period === 'term' ? 'term (≈4 months)' : 'year'}
              </div>
              <ul className="mt-s-4 space-y-s-2 mb-s-5">
                {[
                  'Private solo classroom',
                  'Up to 60 pupils enrolled',
                  'Full lesson library access',
                  'Attendance + gradebook',
                  'Term reports + print PDF',
                  'Parent comms',
                ].map((f) => (
                  <li key={f} className="flex items-center gap-s-2 text-[13px] text-ink-2">
                    <span className="text-green-400 shrink-0">✓</span> {f}
                  </li>
                ))}
              </ul>
              <Button
                intent={tier.period === 'annual' ? 'primary' : 'ghost'}
                onClick={() => handleSubscribe(tier)}
                isLoading={loading === tier.id}
                disabled={!!loading}
                className="w-full justify-center"
              >
                Subscribe {tier.period === 'term' ? '(Per Term)' : '(Annual)'}
              </Button>
            </Card>
          ))}
        </div>

        {error && (
          <div className="mb-s-5 text-[13px] text-red-400 bg-red-400/10 border border-red-400/30 rounded-r-2 px-s-4 py-s-3">
            {error}
          </div>
        )}

        {/* Free preview section */}
        <div className="border-t border-line-2 pt-s-8">
          <h3 className="font-display text-display-3 text-ink-0 mb-s-2">
            Free preview — explore before subscribing
          </h3>
          <p className="text-[13px] text-ink-3 mb-s-5 max-w-[54ch]">
            Here's a taste of what you'll unlock. Demo lessons are read-only
            and change every session.
          </p>

          <div className="space-y-s-3">
            {/* Demo lessons */}
            {(demoLessons ?? []).length > 0 && (
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-gold-400 mb-s-3">
                  Sample lessons
                </div>
                <div className="space-y-s-2">
                  {demoLessons.map((l) => (
                    <div key={l.id}
                      className="bg-surface-2 border border-line-1 rounded-r-2 px-s-4 py-s-3 flex items-center justify-between gap-s-4">
                      <div>
                        <div className="text-[14px] text-ink-0 font-medium">{l.title}</div>
                        <div className="text-[12px] text-ink-3 mt-[1px]">
                          {String(l.level ?? '').replace('_',' ')} · {String(l.subject ?? '')} · Week {l.week_of_term}
                        </div>
                      </div>
                      <Chip variant="default" size="sm">Preview</Chip>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sample attendance mock */}
            <DemoAttendanceMock />

            {/* Sample report template */}
            <DemoReportMock />
          </div>
        </div>
      </div>
    </AppShell>
  );
}

// ── Demo mocks ────────────────────────────────────────────────────────────────

function DemoAttendanceMock() {
  return (
    <div>
      <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-gold-400 mb-s-3">
        Sample attendance sheet
      </div>
      <div className="relative bg-surface-2 border border-line-1 rounded-r-2 overflow-hidden">
        {/* Blurred table */}
        <table className="w-full text-[12px] select-none pointer-events-none" aria-hidden>
          <thead>
            <tr className="border-b border-line-2">
              {['Pupil', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((h) => (
                <th key={h} className="text-left px-s-3 py-s-2 text-ink-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {['Amina B.', 'Chidi O.', 'Fatima K.', 'Emeka N.'].map((name) => (
              <tr key={name} className="border-b border-line-1">
                <td className="px-s-3 py-s-2 text-ink-1">{name}</td>
                {['P','P','A','P','P'].map((v, i) => (
                  <td key={i} className="px-s-3 py-s-2">
                    <span className={cn('font-mono text-[11px]', v === 'P' ? 'text-green-400' : 'text-red-400')}>{v}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {/* Lock overlay */}
        <div className="absolute inset-0 backdrop-blur-[2px] bg-surface-1/60 flex items-center justify-center">
          <div className="text-center">
            <div className="text-[20px] mb-s-2">🔒</div>
            <div className="text-[12px] font-medium text-ink-1">Subscribe to mark attendance</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DemoReportMock() {
  return (
    <div>
      <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-gold-400 mb-s-3">
        Sample report card template
      </div>
      <div className="relative bg-surface-2 border border-line-1 rounded-r-2 p-s-4 overflow-hidden">
        <div className="select-none pointer-events-none" aria-hidden>
          <div className="flex items-center justify-between mb-s-3">
            <div className="text-[14px] font-medium text-ink-0">First Term Report — Primary 3</div>
            <div className="font-mono text-[11px] text-ink-4">2024/2025</div>
          </div>
          <div className="grid grid-cols-3 gap-s-2">
            {['Mathematics', 'English', 'Basic Sci', 'Social Studies', 'French', 'Computer'].map((s) => (
              <div key={s} className="bg-surface-3 rounded-r-1 px-s-2 py-s-2">
                <div className="text-[11px] text-ink-3">{s}</div>
                <div className="text-[16px] font-display text-ink-0">—</div>
              </div>
            ))}
          </div>
        </div>
        {/* Lock overlay */}
        <div className="absolute inset-0 backdrop-blur-[2px] bg-surface-1/60 flex items-center justify-center">
          <div className="text-center">
            <div className="text-[20px] mb-s-2">🔒</div>
            <div className="text-[12px] font-medium text-ink-1">Subscribe to generate reports</div>
          </div>
        </div>
      </div>
    </div>
  );
}
