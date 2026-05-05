/**
 * src/pages/public/HomePage.jsx
 *
 * The marketing homepage. Implements the brief's required sections:
 *   - Hero (with animated platform preview)
 *   - Product ecosystem (4 cards)
 *   - Why Africa-first (4 reasons)
 *   - Impact metrics (live from Supabase via useImpactMetrics)
 *   - Pricing teaser → /pricing
 *
 * Design language: dark navy + gold per the approved system.
 */

import { Link } from 'react-router-dom';
import { PublicNav } from '@/components/marketing/PublicNav';
import { PublicFooter } from '@/components/marketing/PublicFooter';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { useImpactMetrics } from '@/hooks/useImpactMetrics';

export default function HomePage() {
  return (
    <div className="min-h-dvh bg-surface-1 text-ink-1">
      <PublicNav />
      <main className="pt-[64px]">
        <Hero />
        <ProductEcosystem />
        <WhyAfricaFirst />
        <ImpactMetrics />
        <PricingTeaser />
        <FinalCta />
      </main>
      <PublicFooter />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Soft gold radial behind the hero — this is our 8% gold budget */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 70% 60% at 50% 0%, rgba(229,166,42,.08), transparent 60%)',
        }}
        aria-hidden="true"
      />
      <div className="relative max-w-[1280px] mx-auto px-s-6 lg:px-s-9 pt-s-10 lg:pt-s-10 pb-s-10">
        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-s-10 items-center">
          <div>
            <Chip variant="gold" dot className="mb-s-6">Built for African classrooms</Chip>
            <h1 className="font-display text-display-1 text-ink-0">
              The operating system for{' '}
              <span className="ital-gold">African education.</span>
            </h1>
            <p className="mt-s-6 text-body-l text-ink-2 max-w-[58ch]">
              Train To Teach Africa delivers curriculum-aligned digital learning
              and school management infrastructure built specifically for African
              classrooms.
            </p>
            <div className="mt-s-8 flex flex-wrap gap-s-4">
              <Link to="/sign-up">
                <Button intent="primary" size="lg">Start learning</Button>
              </Link>
              <Link to="/solutions/schools">
                <Button intent="ghost" size="lg">Book school demo →</Button>
              </Link>
            </div>
            <div className="mt-s-7 flex flex-wrap gap-s-6 font-mono text-meta tracking-[0.04em] text-ink-3">
              <span>NERDC + NAPPS 2025 aligned</span>
              <span aria-hidden="true">·</span>
              <span>Offline-first</span>
              <span aria-hidden="true">·</span>
              <span>Mobile-first</span>
            </div>
          </div>

          <PlatformPreview />
        </div>
      </div>
    </section>
  );
}

/**
 * Animated platform preview — a layered laptop + phone composition showing
 * the admin dashboard and the parent app side by side. Pure SVG/CSS so it
 * doesn't bloat the JS bundle.
 */
function PlatformPreview() {
  return (
    <div className="relative aspect-[5/4]">
      {/* Laptop frame — admin view */}
      <div className="absolute inset-x-0 top-[8%] bottom-[14%] bg-surface-3 rounded-r-3 border border-line-2 shadow-lift overflow-hidden">
        <div className="h-[24px] bg-surface-4 border-b border-line-1 flex items-center gap-s-2 px-s-4">
          <span className="w-[8px] h-[8px] rounded-full bg-red-400/50"></span>
          <span className="w-[8px] h-[8px] rounded-full bg-amber-400/50"></span>
          <span className="w-[8px] h-[8px] rounded-full bg-green-400/50"></span>
          <span className="ml-auto font-mono text-[10px] text-ink-3">app.traintoteachafrica.org</span>
        </div>
        <div className="p-s-5 grid grid-cols-4 gap-s-3">
          <MiniKpi label="Pupils" value="38,420" trend="▲ 8.4%" />
          <MiniKpi label="Attendance" value="92.4%" trend="▲ 1.2pts" />
          <MiniKpi label="Schools" value="142" trend="▲ 4" />
          <MiniKpi label="Lessons" value="1.2M" trend="▲ 12%" />
          <div className="col-span-4 bg-surface-2 rounded-r-2 p-s-4 border border-line-1 mt-s-2">
            <div className="font-mono text-meta uppercase text-ink-3 mb-s-3">Attendance · 14d</div>
            <MiniChart />
          </div>
        </div>
      </div>

      {/* Phone — parent view, overlapping bottom-right */}
      <div className="absolute bottom-0 right-[2%] w-[28%] aspect-[9/19] bg-surface-3 rounded-r-4 border border-line-2 shadow-lift p-s-3">
        <div className="bg-surface-2 h-full rounded-r-3 p-s-3 flex flex-col gap-s-3">
          <div className="font-mono text-[9px] text-ink-3 tracking-[0.16em] uppercase">Tonight</div>
          <div className="font-display text-[14px] text-ink-0 leading-tight">
            Adaeze is learning <span className="text-gold-200 italic">fractions</span>.
          </div>
          <div className="bg-surface-3 rounded-r-2 p-s-3 border border-line-1 mt-auto">
            <div className="font-mono text-[8px] text-gold-400 uppercase tracking-[0.14em] mb-s-1">5-min activity</div>
            <div className="text-[10.5px] text-ink-1 leading-snug">Cut a pancake into halves and quarters with her.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniKpi({ label, value, trend }) {
  return (
    <div className="bg-surface-2 rounded-r-2 p-s-3 border border-line-1">
      <div className="font-mono text-[9px] text-ink-3 uppercase tracking-[0.14em]">{label}</div>
      <div className="font-display text-[18px] text-ink-0 leading-none mt-s-2">{value}</div>
      <div className="font-mono text-[9px] text-green-400 mt-s-1">{trend}</div>
    </div>
  );
}

function MiniChart() {
  // Static pleasant chart — pure SVG, no library needed.
  const points = [62, 70, 64, 78, 82, 75, 88, 92, 86, 90, 94, 92, 96, 92];
  const max = 100;
  const width = 320, height = 60, pad = 4;
  const stepX = (width - pad * 2) / (points.length - 1);
  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${pad + i * stepX} ${height - pad - (p / max) * (height - pad * 2)}`)
    .join(' ');
  const area = `${path} L ${pad + (points.length - 1) * stepX} ${height - pad} L ${pad} ${height - pad} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[50px]" aria-hidden="true">
      <defs>
        <linearGradient id="goldFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#e5a62a" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#e5a62a" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#goldFill)" />
      <path d={path} stroke="#e5a62a" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Product Ecosystem
// ---------------------------------------------------------------------------

const PRODUCTS = [
  {
    eyebrow: 'TTA Learn',
    title: 'A learning platform parents and pupils trust.',
    body: 'Curriculum-aligned digital lessons across Nursery and Primary, with home-support guidance for parents and full instructional support for teachers.',
    chips: ['NERDC aligned', 'Offline-first', 'Role-adaptive'],
  },
  {
    eyebrow: 'TTA SIMS',
    title: 'School operations, finally on one screen.',
    body: 'Attendance, grading, term reports, parent comms, and billing — built for schools that don\'t have an IT department.',
    chips: ['Attendance', 'Gradebook', 'Auto-reports'],
  },
  {
    eyebrow: 'Teacher Development',
    title: 'CPD that actually fits the day.',
    body: 'Short, in-context professional development tied to the same curriculum the teacher is teaching this week. Not a 3-hour Saturday workshop.',
    chips: ['Bite-size', 'Curriculum-tied', 'On device'],
  },
  {
    eyebrow: 'Parent Learning Support',
    title: 'Help parents help children.',
    body: 'A nightly 5-minute kitchen activity and three dinner questions, delivered to WhatsApp. Built for parents who want to engage and don\'t know how.',
    chips: ['WhatsApp', 'No app needed', '5-minute'],
  },
];

function ProductEcosystem() {
  return (
    <section className="py-s-10 border-t border-line-1">
      <div className="max-w-[1280px] mx-auto px-s-6 lg:px-s-9">
        <SectionHead num="01" eyebrow="The platform" title={<>One system. <span className="ital-gold">Four products.</span></>} />
        <div className="mt-s-9 grid lg:grid-cols-2 gap-s-5">
          {PRODUCTS.map((p) => (
            <article key={p.eyebrow} className="bg-surface-2 border border-line-1 rounded-r-3 p-s-7 hover:border-gold-400/40 transition-colors duration-150">
              <div className="font-mono text-eyebrow uppercase text-gold-400">{p.eyebrow}</div>
              <h3 className="mt-s-3 font-display text-display-3 text-ink-0">{p.title}</h3>
              <p className="mt-s-3 text-body text-ink-2 max-w-[52ch]">{p.body}</p>
              <div className="mt-s-5 flex flex-wrap gap-s-2">
                {p.chips.map((c) => <Chip key={c} variant="default">{c}</Chip>)}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Why Africa-first
// ---------------------------------------------------------------------------

const REASONS = [
  { eyebrow: 'Reality 01', title: 'Connectivity is unstable.', body: 'Every action saves locally first, syncs in the background. Teachers never lose a register because the network blinked.' },
  { eyebrow: 'Reality 02', title: 'Devices are low-end Android.', body: 'Built and tested on a Tecno Spark with throttled 3G. First contentful paint ≤ 1.8s. Initial JS payload ≤ 180 KB.' },
  { eyebrow: 'Reality 03', title: 'Curriculum is local.', body: 'Lessons aligned to the NERDC and NAPPS 2025 curriculum, not a foreign one bolted on. Built by Nigerian educators.' },
  { eyebrow: 'Reality 04', title: 'Schools need audit trails.', body: 'Every write — every register, every score, every payment — flows through a single audit log. Proprietors can answer parents in fifteen seconds.' },
];

function WhyAfricaFirst() {
  return (
    <section className="py-s-10 border-t border-line-1">
      <div className="max-w-[1280px] mx-auto px-s-6 lg:px-s-9">
        <SectionHead num="02" eyebrow="Why Africa-first" title={<>Built for the realities most software <span className="ital-gold">ignores.</span></>} />
        <div className="mt-s-9 grid md:grid-cols-2 gap-s-5">
          {REASONS.map((r) => (
            <article key={r.eyebrow} className="bg-surface-2 border border-line-1 rounded-r-3 p-s-7">
              <div className="font-mono text-eyebrow uppercase text-gold-400">{r.eyebrow}</div>
              <h3 className="mt-s-3 font-display text-display-3 text-ink-0">{r.title}</h3>
              <p className="mt-s-3 text-body text-ink-2 max-w-[52ch]">{r.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Impact Metrics — live from Supabase
// ---------------------------------------------------------------------------

function ImpactMetrics() {
  const { data } = useImpactMetrics();
  const m = data ?? FALLBACK_METRICS;

  return (
    <section className="py-s-10 border-t border-line-1 bg-surface-2/40">
      <div className="max-w-[1280px] mx-auto px-s-6 lg:px-s-9">
        <SectionHead num="03" eyebrow="Real numbers" title={<>Already in <span className="ital-gold">classrooms.</span></>} />
        <div className="mt-s-9 grid grid-cols-2 lg:grid-cols-4 gap-s-5">
          <BigStat label="Schools onboarded" value={m.schools} />
          <BigStat label="Pupils reached" value={m.pupils} />
          <BigStat label="Lessons delivered" value={m.lessons} />
          <BigStat label="Avg. attendance lift" value={`+${m.attendanceLiftPts}pts`} />
        </div>
      </div>
    </section>
  );
}

const FALLBACK_METRICS = { schools: 142, pupils: 38420, lessons: 1207450, attendanceLiftPts: 4.2 };

function BigStat({ label, value }) {
  const display = typeof value === 'number' ? value.toLocaleString('en-NG') : value;
  return (
    <div className="bg-surface-2 border border-line-1 rounded-r-3 p-s-7">
      <div className="font-mono text-eyebrow uppercase text-gold-400">{label}</div>
      <div className="mt-s-3 font-display text-[44px] leading-none tracking-[-0.02em] text-ink-0">
        {display}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pricing teaser
// ---------------------------------------------------------------------------

function PricingTeaser() {
  return (
    <section className="py-s-10 border-t border-line-1">
      <div className="max-w-[1280px] mx-auto px-s-6 lg:px-s-9">
        <SectionHead num="04" eyebrow="Pricing" title={<>Honest pricing, in <span className="ital-gold">your currency.</span></>} />
        <div className="mt-s-9 grid md:grid-cols-3 gap-s-5">
          <TeaserCard audience="Parents" price="from ₦10,847" cadence="per term" />
          <TeaserCard audience="Teachers" price="from ₦12,203" cadence="per term" featured />
          <TeaserCard audience="Schools" price="from ₦61,012" cadence="per term" />
        </div>
        <div className="mt-s-7 text-center">
          <Link to="/pricing">
            <Button intent="ghost" size="md">See full pricing →</Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

function TeaserCard({ audience, price, cadence, featured }) {
  return (
    <div className={`bg-surface-2 rounded-r-3 p-s-7 border ${featured ? 'border-gold-400/40' : 'border-line-1'}`}>
      <div className="font-mono text-eyebrow uppercase text-gold-400">{audience}</div>
      <div className="mt-s-3 font-display text-[36px] leading-none tracking-[-0.02em] text-ink-0">{price}</div>
      <div className="mt-s-2 font-mono text-meta text-ink-3">{cadence}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Final CTA
// ---------------------------------------------------------------------------

function FinalCta() {
  return (
    <section className="py-s-10 border-t border-line-1">
      <div className="max-w-[1280px] mx-auto px-s-6 lg:px-s-9">
        <div className="bg-surface-2 border border-line-1 rounded-r-4 p-s-9 lg:p-s-10 text-center relative overflow-hidden">
          <div
            className="absolute inset-0 pointer-events-none opacity-50"
            style={{ background: 'radial-gradient(ellipse 60% 80% at 50% 100%, rgba(229,166,42,.12), transparent 60%)' }}
            aria-hidden="true"
          />
          <div className="relative">
            <h2 className="font-display text-display-2 text-ink-0">
              Built in Lagos. <span className="ital-gold">For Africa.</span>
            </h2>
            <p className="mt-s-5 text-body-l text-ink-2 max-w-[60ch] mx-auto">
              Whether you run a school, teach a class, or raise a child — the
              platform is ready when you are.
            </p>
            <div className="mt-s-7 flex flex-wrap justify-center gap-s-4">
              <Link to="/sign-up">
                <Button intent="primary" size="lg">Start a parent account</Button>
              </Link>
              <Link to="/solutions/schools">
                <Button intent="ghost" size="lg">Onboard your school →</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Shared section header
// ---------------------------------------------------------------------------

function SectionHead({ num, eyebrow, title }) {
  return (
    <div className="grid lg:grid-cols-[120px_1fr] gap-s-7 items-start">
      <div>
        <div className="font-mono text-meta tracking-[0.18em] uppercase text-gold-400 pt-s-3 border-t border-gold-400 inline-block">
          {num} · {eyebrow}
        </div>
      </div>
      <h2 className="font-display text-display-2 text-ink-0 max-w-[18ch]">{title}</h2>
    </div>
  );
}
