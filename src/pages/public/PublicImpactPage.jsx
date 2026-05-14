/**
 * src/pages/public/PublicImpactPage.jsx
 *
 * /impact/:schoolSlug
 *
 * Unauthenticated. No auth required. No personal data exposed.
 * Shows only aggregate metrics for schools that have enabled the page.
 *
 * PURPOSE
 * ───────
 * - Shareable link for grant applications ("here's our impact")
 * - Embeddable in school websites
 * - Community transparency for parents and local government
 *
 * WHAT IS SHOWN (only if impact_page_enabled = true in DB)
 * ─────────────────────────────────────────────────────────
 * - School name + tagline
 * - Pupil count + linked parent count
 * - Attendance rate (14-day) + trend
 * - Average grade score
 * - Parent engagement rate (% active this week)
 * - WhatsApp lessons delivered
 * - PDF downloads
 *
 * WHAT IS NEVER SHOWN
 * ────────────────────
 * - Individual pupil names or scores
 * - Parent names, emails, phone numbers
 * - Internal KPIs (billing, alerts, staff)
 * - Subscription status of any user
 */

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import * as impactService from '@/services/impactService';

export function PublicImpactPage() {
  const { schoolSlug } = useParams();
  const [impact,  setImpact]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    impactService.getPublicSchoolImpact(schoolSlug)
      .then((data) => {
        if (!data) setNotFound(true);
        else setImpact(data);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [schoolSlug]);

  if (loading)  return <PageShell><Loading /></PageShell>;
  if (notFound) return <PageShell><NotFoundState /></PageShell>;

  const atTrend = impact.attendance_trend_pts;

  return (
    <PageShell>
      {/* Header */}
      <header className="mb-s-12 text-center">
        <a href="/" className="inline-block mb-s-7">
          <div className="font-mono text-eyebrow uppercase text-gold-400 tracking-widest">
            Train To Teach Africa
          </div>
        </a>
        <div className="font-mono text-meta uppercase text-ink-3 mb-s-3 tracking-[0.16em]">
          School impact report
        </div>
        <h1 className="font-display text-display-1 text-ink-0">
          {impact.school_name}
        </h1>
        {impact.impact_page_tagline && (
          <p className="mt-s-4 text-body-l text-ink-2 max-w-[52ch] mx-auto">
            {impact.impact_page_tagline}
          </p>
        )}
      </header>

      {/* Hero stats — two large numbers */}
      <div className="grid grid-cols-2 gap-s-5 mb-s-9">
        <HeroStat
          value={impact.pupil_count?.toLocaleString() ?? '—'}
          label="Pupils enrolled"
          sub={`${impact.linked_parent_count?.toLocaleString() ?? '—'} parents linked`}
        />
        <HeroStat
          value={impact.attendance_14d_pct != null ? `${impact.attendance_14d_pct}%` : '—'}
          label="Attendance rate"
          sub={atTrend != null
            ? `${atTrend > 0 ? '+' : ''}${atTrend} pts vs previous period`
            : '14-day average'}
          delta={atTrend}
        />
      </div>

      {/* Metric cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-s-5 mb-s-12">
        <MetricCard
          eyebrow="Learning outcomes"
          value={impact.avg_score_pct != null ? `${impact.avg_score_pct}%` : '—'}
          label="Average grade score"
          description="Across all recorded assessments this term"
        />
        <MetricCard
          eyebrow="Parent engagement"
          value={impact.parent_engagement_7d_pct != null ? `${impact.parent_engagement_7d_pct}%` : '—'}
          label="Parents active this week"
          description={`${impact.lesson_views_7d ?? 0} lesson views in the last 7 days`}
        />
        <MetricCard
          eyebrow="Home learning"
          value={(impact.pdf_downloads_7d ?? 0).toLocaleString()}
          label="PDF lesson downloads"
          description="Parents saving lessons for offline use this week"
        />
        <MetricCard
          eyebrow="Nightly delivery"
          value={(impact.whatsapp_sent_7d ?? 0).toLocaleString()}
          label="WhatsApp lessons sent"
          description="Lesson activities delivered to parents this week"
        />
      </div>

      {/* How it works */}
      <div className="border-t border-line-2 pt-s-10 mb-s-12">
        <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-5 text-center">
          How it works
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-s-6 text-center">
          {[
            {
              num: '01',
              title: 'Teachers record learning',
              body: 'Daily attendance and assessment scores are entered by class teachers using the TTA school management system.',
            },
            {
              num: '02',
              title: 'Parents receive lessons',
              body: 'Every evening, parents receive a WhatsApp message with a 5-minute home activity aligned to what their child learned that day.',
            },
            {
              num: '03',
              title: 'Outcomes are measured',
              body: 'Attendance trends, grade improvements, and parent engagement are tracked weekly and published here — transparently.',
            },
          ].map((s) => (
            <div key={s.num}>
              <div className="font-display text-[42px] text-gold-400/30 mb-s-3">{s.num}</div>
              <h3 className="font-display text-display-3 text-ink-0 mb-s-2">{s.title}</h3>
              <p className="text-body text-ink-2">{s.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer CTA */}
      <div className="text-center border-t border-line-2 pt-s-9">
        <p className="text-body text-ink-2 mb-s-5">
          This page is published by {impact.school_name} using Train To Teach Africa.
        </p>
        <div className="flex flex-wrap gap-s-4 justify-center">
          <Link
            to="/"
            className="inline-block font-mono text-meta text-gold-400 hover:underline"
          >
            Learn about TTA →
          </Link>
          <Link
            to="/solutions/schools"
            className="inline-block font-mono text-meta text-ink-3 hover:text-ink-1"
          >
            For schools →
          </Link>
        </div>
        <p className="mt-s-6 font-mono text-meta text-ink-3">
          All metrics are aggregated. No individual pupil or parent data is displayed.
          Updated every 5 minutes.
        </p>
      </div>
    </PageShell>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PageShell({ children }) {
  return (
    <div className="min-h-screen bg-surface-1">
      <main className="max-w-[760px] mx-auto px-s-5 py-s-12 sm:py-s-16">
        {children}
      </main>
    </div>
  );
}

function HeroStat({ value, label, sub, delta }) {
  const deltaColor = delta == null ? ''
    : delta > 0 ? 'text-green-400'
    : delta < 0 ? 'text-amber-400'
    : 'text-ink-3';

  return (
    <div className="bg-surface-2 border border-line-2 rounded-r-3 p-s-7 text-center">
      <div className="font-display text-[52px] leading-none text-ink-0 mb-s-2">
        {value}
      </div>
      <div className="text-body text-ink-0 mb-s-1">{label}</div>
      <div className={`font-mono text-meta ${delta != null ? deltaColor : 'text-ink-3'}`}>
        {sub}
      </div>
    </div>
  );
}

function MetricCard({ eyebrow, value, label, description }) {
  return (
    <div className="bg-surface-2 border border-line-2 rounded-r-3 p-s-7">
      <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-3">
        {eyebrow}
      </div>
      <div className="font-display text-[38px] leading-none text-ink-0 mb-s-2">
        {value}
      </div>
      <div className="text-body text-ink-0 mb-s-1">{label}</div>
      <div className="font-mono text-meta text-ink-3">{description}</div>
    </div>
  );
}

function Loading() {
  return (
    <div className="space-y-s-5">
      <div className="h-32 rounded-r-3 bg-surface-2 border border-line-2 animate-pulse" />
      <div className="grid grid-cols-2 gap-s-5">
        <div className="h-40 rounded-r-3 bg-surface-2 border border-line-2 animate-pulse" />
        <div className="h-40 rounded-r-3 bg-surface-2 border border-line-2 animate-pulse" />
      </div>
    </div>
  );
}

function NotFoundState() {
  return (
    <div className="text-center py-s-16">
      <div className="font-mono text-eyebrow uppercase text-ink-3 mb-s-4">
        Page not found
      </div>
      <h1 className="font-display text-display-2 text-ink-0 mb-s-5">
        This school's impact page isn't public yet.
      </h1>
      <p className="text-body text-ink-2 mb-s-7 max-w-[48ch] mx-auto">
        The school may not have enabled their public impact page,
        or the link may be incorrect.
      </p>
      <Link to="/" className="font-mono text-meta text-gold-400 hover:underline">
        ← Back to Train To Teach Africa
      </Link>
    </div>
  );
}
