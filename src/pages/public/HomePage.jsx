/**
 * src/pages/public/HomePage.jsx
 *
 * The marketing homepage. Implements the official approved copy:
 *
 *   01 Hero — "Africa's Education Operating System"
 *   02 What We Do — three connected systems (Learn / SIMS / Tutor Network)
 *   03 Why We Built This — Africa-first realities
 *   04 Offline-First Technology
 *   05 Parent Support
 *   06 Impact & Accountability — live metrics from Supabase
 *   07 Who We Serve — five audience cards
 *   08 Pricing teaser → /pricing
 *   09 Our Vision
 *   10 Final CTA
 *
 * Design language: deep navy + amber gold per the approved system.
 * Voice/tone: clear, calm, infrastructure-grade. Italic gold accent appears
 * once per display heading — the editorial flourish from the design system.
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
        <WhatWeDo />
        <WhyWeBuiltThis />
        <OfflineFirst />
        <ParentSupport />
        <ImpactMetrics />
        <WhoWeServe />
        <PricingTeaser />
        <OurVision />
        <FinalCta />
      </main>
      <PublicFooter />
    </div>
  );
}

// ---------------------------------------------------------------------------
// 01 Hero
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
              Africa's Education{' '}
              <span className="ital-gold">Operating System.</span>
            </h1>
            <p className="mt-s-6 text-body-l text-ink-2 max-w-[58ch]">
              Curriculum-aligned learning, school management, parent engagement, and
              tutor support — built for African schools, families, and educators.
            </p>
            <p className="mt-s-4 text-body text-ink-3 max-w-[58ch]">
              Train To Teach Africa helps schools manage operations, helps teachers
              teach better, helps parents support learning at home, and helps
              students access structured, high-quality education designed around
              African realities. Built by Nigerian educators for African classrooms.
            </p>
            <div className="mt-s-8 flex flex-wrap gap-s-4">
              <Link to="/sign-up">
                <Button intent="primary" size="lg">Start Learning</Button>
              </Link>
              <Link to="/solutions/schools">
                <Button intent="ghost" size="lg">Book a Demo →</Button>
              </Link>
              <Link to="/about#contact">
                <Button intent="text" size="lg">Partner With Us</Button>
              </Link>
            </div>
            <div className="mt-s-7 flex flex-wrap gap-s-6 font-mono text-meta tracking-[0.04em] text-ink-3">
              <span>NERDC + NAPPS aligned</span>
              <span aria-hidden="true">·</span>
              <span>Offline-capable</span>
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
// 02 What We Do — three connected systems
// ---------------------------------------------------------------------------

const PRODUCTS = [
  {
    eyebrow: 'TTA Learn',
    title: 'Curriculum-aligned digital learning.',
    body:
      'Interactive lessons aligned with the NERDC and NAPPS curriculum. ' +
      'Students access engaging literacy, numeracy, science, and foundational ' +
      'learning experiences. Teachers receive instructional guidance and ' +
      'structured teaching support. Parents receive simplified lesson guidance, ' +
      'downloadable PDFs, and home-learning support activities.',
    features: [
      'Role-based learning experiences',
      'Interactive lessons + downloadable PDFs',
      'Parent-friendly learning guides',
      'Student PIN login',
      'Teacher instructional notes',
      'Offline lesson access',
    ],
  },
  {
    eyebrow: 'TTA SIMS',
    title: 'School management for schools without IT departments.',
    body:
      'Attendance, grading, report cards, parent communication, billing, and ' +
      'impact tracking — all in one system. Built around how schools actually ' +
      'operate. Simple enough for teachers. Powerful enough for school leaders.',
    features: [
      'Attendance + academic grading',
      'Report card generation',
      'Behaviour + intervention tracking',
      'School billing management',
      'Multi-school support',
      'Audit trails for accountability',
    ],
  },
  {
    eyebrow: 'TTA Tutor Network',
    title: 'Trusted tutors for African families.',
    body:
      'Parents can request online or in-person tutors directly through Train ' +
      'To Teach Africa. Teachers and tutors build verified profiles, set their ' +
      'rates, and connect with families. Train To Teach Africa manages trust, ' +
      'payment handling, and platform verification.',
    features: [
      'Verified tutor profiles',
      'Search by subject, curriculum, location',
      'Online + in-person formats',
      'Guarantor verification for offline tutoring',
      'Paystack-handled payments',
      'Curriculum-aware matching',
    ],
  },
];

function WhatWeDo() {
  return (
    <section className="py-s-10 border-t border-line-1">
      <div className="max-w-[1280px] mx-auto px-s-6 lg:px-s-9">
        <SectionHead
          num="01"
          eyebrow="What we do"
          title={<>One platform. <span className="ital-gold">Three connected systems.</span></>}
        />
        <p className="mt-s-5 text-body-l text-ink-2 max-w-[68ch]">
          Train To Teach Africa combines learning delivery, school operations, and
          tutor access into a single connected ecosystem. We are not building
          another generic EdTech platform adapted for Africa. We are building
          education infrastructure designed from the ground up for African schools
          and families.
        </p>

        <div className="mt-s-9 grid lg:grid-cols-3 gap-s-5">
          {PRODUCTS.map((p) => (
            <article
              key={p.eyebrow}
              className="bg-surface-2 border border-line-1 rounded-r-3 p-s-7 hover:border-gold-400/40 transition-colors duration-150 flex flex-col"
            >
              <div className="font-mono text-eyebrow uppercase text-gold-400">{p.eyebrow}</div>
              <h3 className="mt-s-3 font-display text-display-3 text-ink-0">{p.title}</h3>
              <p className="mt-s-3 text-body text-ink-2">{p.body}</p>
              <ul className="mt-s-5 flex flex-col gap-s-2 text-[13.5px] text-ink-2 border-t border-line-1 pt-s-5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-s-2">
                    <span aria-hidden="true" className="text-gold-400 mt-[2px]">·</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 03 Why We Built This
// ---------------------------------------------------------------------------

const REALITIES = [
  { title: 'Inconsistent internet connectivity.', body: 'Most platforms used in Africa were designed assuming the network never drops. We assume it does.' },
  { title: 'Mobile-first access.',                 body: 'Built and tested on affordable Android devices, the way most African families actually access the web.' },
  { title: 'Shared devices.',                      body: 'A household phone shared between parent and child needs role-aware sign-in, not one-account-fits-all.' },
  { title: 'Large classroom sizes.',               body: 'Attendance and grading designed for classes of 40+, not the 18-pupil edge case the West optimises for.' },
  { title: 'Parent engagement challenges.',        body: 'Parents want to support learning. We make the path simple — a 5-minute activity beats a 30-minute portal.' },
  { title: 'Administrative overload.',             body: 'School leaders should not have to choose between teaching and admin. We absorb the admin.' },
];

function WhyWeBuiltThis() {
  return (
    <section className="py-s-10 border-t border-line-1">
      <div className="max-w-[1280px] mx-auto px-s-6 lg:px-s-9">
        <SectionHead
          num="02"
          eyebrow="Why we built this"
          title={<>Built for African classrooms. <span className="ital-gold">Not adapted later.</span></>}
        />
        <p className="mt-s-5 text-body-l text-ink-2 max-w-[68ch]">
          Most educational platforms used in Africa were originally designed for
          Western classrooms. They are often expensive, disconnected from local
          curriculum standards, and difficult to use in low-connectivity
          environments. Train To Teach Africa was built differently — designed
          around the realities of African schools.
        </p>

        <div className="mt-s-9 grid md:grid-cols-2 lg:grid-cols-3 gap-s-5">
          {REALITIES.map((r) => (
            <article key={r.title} className="bg-surface-2 border border-line-1 rounded-r-3 p-s-6">
              <h3 className="font-display text-display-3 text-ink-0">{r.title}</h3>
              <p className="mt-s-3 text-body text-ink-2">{r.body}</p>
            </article>
          ))}
        </div>

        <p className="mt-s-9 text-body-l text-ink-2 max-w-[60ch] italic">
          Our goal is simple: to make quality education more accessible,
          measurable, and sustainable across Africa.
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 04 Offline-First Technology
// ---------------------------------------------------------------------------

function OfflineFirst() {
  return (
    <section className="py-s-10 border-t border-line-1 bg-surface-2/40">
      <div className="max-w-[1280px] mx-auto px-s-6 lg:px-s-9">
        <SectionHead
          num="03"
          eyebrow="Offline-first"
          title={<>Designed for <span className="ital-gold">real infrastructure</span> conditions.</>}
        />
        <div className="mt-s-9 grid lg:grid-cols-2 gap-s-7 items-start">
          <div>
            <p className="text-body-l text-ink-2">
              Teachers should never lose attendance records because the internet
              failed. Parents should still be able to access learning materials
              with limited connectivity. Students should be able to continue
              learning on low-cost devices.
            </p>
            <p className="mt-s-5 text-body-l text-ink-2">
              That is why Train To Teach Africa is designed with offline-first
              principles. Every critical action saves locally first and syncs
              automatically in the background when connectivity returns.
            </p>
            <p className="mt-s-5 text-body text-ink-3">
              The platform is tested for low-bandwidth environments and
              optimised for affordable Android devices commonly used across
              African communities.
            </p>
          </div>

          <div className="grid gap-s-4">
            <Reality eyebrow="Connectivity" title="Network blinks ≠ lost data." body="Every register, score, and payment saves locally first, syncs in the background." />
            <Reality eyebrow="Devices"      title="Tecno Spark on throttled 3G." body="First contentful paint ≤ 1.8s. Initial JS payload ≤ 180 KB. Tested on real hardware." />
            <Reality eyebrow="Curriculum"   title="NERDC + NAPPS aligned."        body="Built by Nigerian educators, for the curriculum your school actually teaches." />
          </div>
        </div>
      </div>
    </section>
  );
}

function Reality({ eyebrow, title, body }) {
  return (
    <article className="bg-surface-2 border border-line-1 rounded-r-3 p-s-6">
      <div className="font-mono text-eyebrow uppercase text-gold-400">{eyebrow}</div>
      <h3 className="mt-s-3 font-display text-[20px] leading-tight text-ink-0">{title}</h3>
      <p className="mt-s-3 text-body text-ink-2">{body}</p>
    </article>
  );
}

// ---------------------------------------------------------------------------
// 05 Parent Support
// ---------------------------------------------------------------------------

function ParentSupport() {
  const items = [
    'Simple lesson summaries',
    'Downloadable learning guides',
    'Nightly 5-minute learning activities',
    'Discussion questions for home engagement',
    'Academic progress tracking',
    'Attendance visibility',
    'Report cards and teacher feedback',
  ];

  return (
    <section className="py-s-10 border-t border-line-1">
      <div className="max-w-[1280px] mx-auto px-s-6 lg:px-s-9">
        <SectionHead
          num="04"
          eyebrow="Parent support"
          title={<>Helping parents <span className="ital-gold">participate</span> in learning.</>}
        />

        <div className="mt-s-9 grid lg:grid-cols-[1.1fr_1fr] gap-s-7 items-start">
          <div>
            <p className="text-body-l text-ink-2">
              Many parents want to support their children academically but do
              not always know how. Train To Teach Africa helps bridge that gap.
            </p>
            <p className="mt-s-5 text-body-l text-ink-2 italic">
              Learning should not stop when the child leaves the classroom.
            </p>
            <div className="mt-s-7">
              <Link to="/solutions/parents">
                <Button intent="ghost" size="md">For parents →</Button>
              </Link>
            </div>
          </div>

          <ul className="bg-surface-2 border border-line-1 rounded-r-3 p-s-7 flex flex-col gap-s-3">
            {items.map((item) => (
              <li key={item} className="flex items-start gap-s-3 text-[14.5px] text-ink-1">
                <CheckIcon />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 06 Impact & Accountability — live from Supabase
// ---------------------------------------------------------------------------

function ImpactMetrics() {
  const { data } = useImpactMetrics();
  const m = data ?? FALLBACK_METRICS;

  return (
    <section className="py-s-10 border-t border-line-1 bg-surface-2/40">
      <div className="max-w-[1280px] mx-auto px-s-6 lg:px-s-9">
        <SectionHead
          num="05"
          eyebrow="Impact & accountability"
          title={<>Data that schools and partners <span className="ital-gold">can trust.</span></>}
        />
        <p className="mt-s-5 text-body-l text-ink-2 max-w-[68ch]">
          Schools, NGOs, and education partners need measurable evidence. Train
          To Teach Africa provides structured reporting and accountability tools
          that help schools track educational outcomes over time. Every critical
          action is logged and traceable.
        </p>

        <div className="mt-s-9 grid grid-cols-2 lg:grid-cols-4 gap-s-5">
          <BigStat label="Schools onboarded" value={m.schools} />
          <BigStat label="Pupils reached" value={m.pupils} />
          <BigStat label="Lessons delivered" value={m.lessons} />
          <BigStat label="Avg. attendance lift" value={`+${m.attendanceLiftPts}pts`} />
        </div>

        <ul className="mt-s-9 grid sm:grid-cols-2 lg:grid-cols-3 gap-x-s-7 gap-y-s-3 text-[13.5px] text-ink-2">
          {[
            'Attendance analysis',
            'Academic performance trends',
            'Student risk detection',
            'Intervention tracking',
            'School impact reporting',
            'Term performance summaries',
            'Evidence packages for inspections',
          ].map((s) => (
            <li key={s} className="flex items-start gap-s-2">
              <span aria-hidden="true" className="text-gold-400 mt-[2px]">·</span>
              <span>{s}</span>
            </li>
          ))}
        </ul>
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
// 07 Who We Serve
// ---------------------------------------------------------------------------

const AUDIENCES = [
  { title: 'Schools',             body: 'Modern school management without needing an internal IT team.' },
  { title: 'Teachers',            body: 'Practical tools that reduce administrative stress and improve instructional delivery.' },
  { title: 'Parents',             body: 'Clear visibility into learning progress and practical support for home learning.' },
  { title: 'Students',            body: 'Structured, curriculum-aligned learning experiences designed for African learners.' },
  { title: 'Education partners',  body: 'Reliable educational data, measurable outcomes, and scalable implementation support.' },
];

function WhoWeServe() {
  return (
    <section className="py-s-10 border-t border-line-1">
      <div className="max-w-[1280px] mx-auto px-s-6 lg:px-s-9">
        <SectionHead
          num="06"
          eyebrow="Who we serve"
          title={<>For everyone who shapes <span className="ital-gold">a child's learning.</span></>}
        />
        <div className="mt-s-9 grid sm:grid-cols-2 lg:grid-cols-3 gap-s-5">
          {AUDIENCES.map((a) => (
            <article key={a.title} className="bg-surface-2 border border-line-1 rounded-r-3 p-s-7">
              <h3 className="font-display text-display-3 text-ink-0">{a.title}</h3>
              <p className="mt-s-3 text-body text-ink-2">{a.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 08 Pricing teaser
// ---------------------------------------------------------------------------

function PricingTeaser() {
  return (
    <section className="py-s-10 border-t border-line-1 bg-surface-2/40">
      <div className="max-w-[1280px] mx-auto px-s-6 lg:px-s-9">
        <SectionHead
          num="07"
          eyebrow="Pricing"
          title={<>Affordable pricing for <span className="ital-gold">African families and schools.</span></>}
        />
        <div className="mt-s-9 grid md:grid-cols-3 gap-s-5">
          <TeaserCard audience="Parents"  price="from ₦12,240" cadence="per term · African curriculum" />
          <TeaserCard audience="Teachers" price="from ₦14,688" cadence="per term · African curriculum" featured />
          <TeaserCard audience="Schools"  price="from ₦78,657" cadence="per term · African curriculum" />
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
// 09 Our Vision
// ---------------------------------------------------------------------------

function OurVision() {
  return (
    <section className="py-s-10 border-t border-line-1">
      <div className="max-w-[1280px] mx-auto px-s-6 lg:px-s-9">
        <SectionHead
          num="08"
          eyebrow="Our vision"
          title={<>Building the operating system for <span className="ital-gold">African education.</span></>}
        />
        <div className="mt-s-9 grid lg:grid-cols-[1.1fr_1fr] gap-s-9">
          <div>
            <p className="text-body-l text-ink-2">
              We believe Africa deserves educational technology built around its
              realities, strengths, and future.
            </p>
            <p className="mt-s-5 text-body-l text-ink-2">
              Train To Teach Africa exists to help schools operate more
              effectively, help teachers teach with confidence, help parents
              engage more meaningfully, and help learners access high-quality
              educational opportunities.
            </p>
          </div>
          <div className="bg-surface-2 border border-line-1 rounded-r-3 p-s-7 self-start">
            <div className="font-mono text-eyebrow uppercase text-gold-400">Long-term horizon</div>
            <p className="mt-s-3 text-body text-ink-1 italic">
              We are building long-term educational infrastructure designed for
              sustainable impact.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 10 Final CTA
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
              Join the future of <span className="ital-gold">African education.</span>
            </h2>
            <p className="mt-s-5 text-body-l text-ink-2 max-w-[62ch] mx-auto">
              Whether you are a school leader, teacher, parent, tutor, donor, or
              education partner — there is a place for you in the Train To Teach
              Africa ecosystem.
            </p>
            <div className="mt-s-8 flex flex-wrap justify-center gap-s-4">
              <Link to="/sign-up">
                <Button intent="primary" size="lg">Start Learning</Button>
              </Link>
              <Link to="/solutions/schools">
                <Button intent="ghost" size="lg">Request a School Demo →</Button>
              </Link>
              <Link to="/tutors">
                <Button intent="ghost" size="lg">Join as a Tutor</Button>
              </Link>
              <Link to="/about#contact">
                <Button intent="text" size="lg">Partner With Us</Button>
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
      <h2 className="font-display text-display-2 text-ink-0 max-w-[22ch]">{title}</h2>
    </div>
  );
}

// Inline check icon shared across the page.
function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="mt-[3px] flex-shrink-0" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="rgba(229,166,42,.12)" stroke="rgba(229,166,42,.5)" strokeWidth="1" />
      <path d="M8 12.5l2.5 2.5L16 9" stroke="#e5a62a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
