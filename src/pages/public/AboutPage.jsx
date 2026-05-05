/**
 * src/pages/public/AboutPage.jsx
 *
 * Light "About + Impact + Contact" page. The brand story.
 */

import { Link } from 'react-router-dom';
import { PublicNav } from '@/components/marketing/PublicNav';
import { PublicFooter } from '@/components/marketing/PublicFooter';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';

export default function AboutPage() {
  return (
    <div className="min-h-dvh bg-surface-1 text-ink-1">
      <PublicNav />
      <main className="pt-[64px]">
        <section className="border-b border-line-1 py-s-10">
          <div className="max-w-[1280px] mx-auto px-s-6 lg:px-s-9">
            <Chip variant="gold" dot>About</Chip>
            <h1 className="mt-s-5 font-display text-display-1 text-ink-0 max-w-[20ch]">
              Built in Lagos. <span className="ital-gold">For Africa.</span>
            </h1>
            <p className="mt-s-7 text-body-l text-ink-2 max-w-[60ch]">
              We are educators and engineers who believe African schools
              deserve infrastructure built for African realities — unstable
              networks, low-end Android, NERDC-aligned curriculum, and
              households that pay in Naira.
            </p>
          </div>
        </section>

        <section id="impact" className="border-b border-line-1 py-s-10">
          <div className="max-w-[1280px] mx-auto px-s-6 lg:px-s-9">
            <h2 className="font-display text-display-2 text-ink-0 mb-s-7">Our principles.</h2>
            <div className="grid md:grid-cols-2 gap-s-5">
              <Principle n="01" title="Africa-first, not Africa-also." body="The platform is engineered around the realities of African classrooms. Foreign-built systems that arrive translated don't survive the first connectivity drop." />
              <Principle n="02" title="Honest pricing." body="African families pay in Naira. We don't move our prices when the FX market sneezes. The number on the screen is the number that comes off your bank statement." />
              <Principle n="03" title="Trust beats features." body="Schools don't need 200 features. They need three things that work every time, even when the lights cut out." />
              <Principle n="04" title="Built to last decades." body="We're building infrastructure, not a season's app. The architecture decisions reflect a 20-year horizon, not a fundraise milestone." />
            </div>
          </div>
        </section>

        <section id="contact" className="py-s-10">
          <div className="max-w-[1280px] mx-auto px-s-6 lg:px-s-9 text-center">
            <h2 className="font-display text-display-2 text-ink-0">Want to talk?</h2>
            <p className="mt-s-4 text-body-l text-ink-2 max-w-[55ch] mx-auto">
              Whether you run a school, want to partner, or want to write
              about us — we'd be glad to hear from you.
            </p>
            <div className="mt-s-7 flex flex-wrap justify-center gap-s-4">
              <a href="mailto:hello@traintoteachafrica.org">
                <Button intent="primary" size="lg">hello@traintoteachafrica.org</Button>
              </a>
              <Link to="/solutions/schools">
                <Button intent="ghost" size="lg">Book a school demo →</Button>
              </Link>
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
