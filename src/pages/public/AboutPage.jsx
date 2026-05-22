/**
 * src/pages/public/AboutPage.jsx
 *
 * About / Vision / Contact page. Mirrors the approved homepage voice but
 * goes deeper on the vision narrative, the four guiding principles, and the
 * partner / contact surface.
 */

import { usePageMeta } from '@/hooks/usePageMeta';
import { Link } from 'react-router-dom';
import { PublicNav } from '@/components/marketing/PublicNav';
import { PublicFooter } from '@/components/marketing/PublicFooter';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';

export default function AboutPage() {
  usePageMeta('About TTA', 'Train To Teach Africa is building ethical educational infrastructure for African schools.');
  return (
    <div className="min-h-dvh bg-surface-1 text-ink-1">
      <PublicNav />
      <main className="pt-[64px]">

        {/* Hero / vision */}
        <section className="border-b border-line-1 py-s-10">
          <div className="max-w-[1280px] mx-auto px-s-6 lg:px-s-9">
            <Chip variant="gold" dot>About</Chip>
            <h1 className="mt-s-5 font-display text-display-1 text-ink-0 max-w-[22ch]">
              Building the operating system for{' '}
              <span className="ital-gold">African education.</span>
            </h1>
            <p className="mt-s-7 text-body-l text-ink-2 max-w-[64ch]">
              We believe Africa deserves educational technology built around its
              realities, strengths, and future. Train To Teach Africa exists to
              help schools operate more effectively, help teachers teach with
              confidence, help parents engage more meaningfully, and help
              learners access high-quality educational opportunities.
            </p>
            <p className="mt-s-5 text-body-l text-ink-2 max-w-[64ch] italic">
              We are building long-term educational infrastructure designed for
              sustainable impact.
            </p>
          </div>
        </section>

        {/* Principles */}
        <section id="impact" className="border-b border-line-1 py-s-10">
          <div className="max-w-[1280px] mx-auto px-s-6 lg:px-s-9">
            <h2 className="font-display text-display-2 text-ink-0 mb-s-7">
              Our principles.
            </h2>
            <div className="grid md:grid-cols-2 gap-s-5">
              <Principle
                n="01"
                title="Africa-first, not Africa-also."
                body="The platform is engineered around the realities of African classrooms."
              />
              <Principle
                n="02"
                title="Honest pricing."
                body="African families pay in their currency. We don't move our prices when the FX market sneezes. The number on the screen is the number that comes off your bank statement."
              />
              <Principle
                n="03"
                title="Trust beats features."
                body="Schools don't need 200 features. They need a handful of things that work every time, even when the lights cut out."
              />
              <Principle
                n="04"
                title="Built to last decades."
                body="We're building infrastructure, not a season's app. The architecture decisions reflect a 20-year horizon, not a fundraise milestone."
              />
            </div>
          </div>
        </section>

        {/* Who we are */}
        <section className="border-b border-line-1 py-s-10 bg-surface-2/40">
          <div className="max-w-[1280px] mx-auto px-s-6 lg:px-s-9">
            <h2 className="font-display text-display-2 text-ink-0 mb-s-7">
              Built in Africa. <span className="ital-gold">For Africa.</span>
            </h2>
            <div className="grid lg:grid-cols-2 gap-s-7">
              <p className="text-body-l text-ink-2">
                We are educators who believe African schools
                deserve infrastructure built for African realities — unstable
                networks, low-end Android, Africa-aligned curriculum.
              </p>
              <p className="text-body-l text-ink-2">
                Our team works directly with African schools, parents, and
                teachers to make sure what we ship matches what classrooms
                actually need. Every feature exists because someone on the
                ground asked for it.
              </p>
            </div>
          </div>
        </section>

        {/* Contact */}
        <section id="contact" className="py-s-10">
          <div className="max-w-[1280px] mx-auto px-s-6 lg:px-s-9 text-center">
            <h2 className="font-display text-display-2 text-ink-0">Want to talk?</h2>
            <p className="mt-s-4 text-body-l text-ink-2 max-w-[58ch] mx-auto">
              Whether you run a school, want to partner, are looking to write
              about us, or simply want to learn more; we'd be glad to hear
              from you.
            </p>
            <div className="mt-s-7 flex flex-wrap justify-center gap-s-4">
              <a href="mailto:support@traintoteachafrica.org">
                <Button intent="primary" size="lg">support@traintoteachafrica.org</Button>
              </a>
              <Link to="/solutions/schools">
                <Button intent="ghost" size="lg">Book a School Demo →</Button>
              </Link>
              <Link to="/tutors">
                <Button intent="text" size="lg">Join as a Tutor</Button>
              </Link>
            </div>
            <div className="mt-s-7 font-mono text-meta tracking-[0.18em] uppercase text-ink-3">
              Lagos · Nigeria
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}

function Principle({ n, title, body }) {
  return (
    <article className="bg-surface-2 border border-line-1 rounded-r-3 p-s-7">
      <div className="font-mono text-eyebrow uppercase text-gold-400">Principle {n}</div>
      <h3 className="mt-s-3 font-display text-display-3 text-ink-0">{title}</h3>
      <p className="mt-s-3 text-body text-ink-2 max-w-[52ch]">{body}</p>
    </article>
  );
}
