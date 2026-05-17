/**
 * src/pages/public/SolutionsSchoolsPage.jsx
 *
 * Public marketing page targeted at school leaders, proprietors, and head
 * teachers. Mirrors the approved "TTA SIMS" section of the homepage with
 * fuller feature coverage.
 *
 * Voice: confident, infrastructure-grade. School leaders want to know what
 * works, who supports them, and how long onboarding takes.
 */

import { Link } from 'react-router-dom';
import { PublicNav } from '@/components/marketing/PublicNav';
import { PublicFooter } from '@/components/marketing/PublicFooter';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';

const DEMO_MAILTO = 'mailto:support@traintoteachafrica.org?subject=School%20demo';

export default function SolutionsSchoolsPage() {
  return (
    <div className="min-h-dvh bg-surface-1 text-ink-1">
      <PublicNav />
      <main className="pt-[64px]">

        {/* Hero */}
        <section className="border-b border-line-1 py-s-10">
          <div className="max-w-[1280px] mx-auto px-s-6 lg:px-s-9">
            <Chip variant="gold" dot>For Schools</Chip>
            <h1 className="mt-s-5 font-display text-display-1 text-ink-0 max-w-[22ch]">
              School management built for schools <span className="ital-gold">without IT departments.</span>
            </h1>
            <p className="mt-s-7 text-body-l text-ink-2 max-w-[64ch]">
              Attendance, grading, report cards, parent communication, billing,
              and impact tracking — all in one system. Built around how schools
              actually operate. Simple enough for teachers. Powerful enough for
              school leaders.
            </p>
            <div className="mt-s-7 flex flex-wrap gap-s-4">
              <a href={DEMO_MAILTO}>
                <Button intent="primary" size="lg">Book a Demo</Button>
              </a>
              <Link to="/pricing"><Button intent="ghost" size="lg">See pricing →</Button></Link>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="border-b border-line-1 py-s-10">
          <div className="max-w-[1280px] mx-auto px-s-6 lg:px-s-9">
            <h2 className="font-display text-display-2 text-ink-0 mb-s-7">
              What's in the bundle.
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-s-5">
              <Feature title="Attendance management"          body="One-tap class registers. Offline-safe. The teacher never loses a record because the network blinked." />
              <Feature title="Academic grading"               body="Score entry that takes minutes per class, not hours. Auto-rolls into term reports." />
              <Feature title="Report card generation"          body="A button. A PDF. A signed link to the parent. No copy-pasting from Excel." />
              <Feature title="Behaviour + intervention tracking" body="Document concerns and interventions in one place. Searchable history for every pupil." />
              <Feature title="Parent communication logs"       body="Every notice, every call, every WhatsApp — logged against the pupil. Never lose context." />
              <Feature title="School billing"                  body="Track tuition, generate receipts, see who's behind. Paystack-powered settlement." />
              <Feature title="Multi-school support"            body="Run a group of schools? One login, every campus. We've worked with multi-school operators." />
              <Feature title="Audit trails for accountability" body="Every write — every register, every score, every payment — flows through a single audit log." />
              <Feature title="Impact reporting"                body="Term summaries, attendance trends, evidence packages for inspectors and funding partners." />
            </div>
          </div>
        </section>

        {/* Why schools choose us */}
        <section className="border-b border-line-1 py-s-10 bg-surface-2/40">
          <div className="max-w-[1280px] mx-auto px-s-6 lg:px-s-9">
            <h2 className="font-display text-display-2 text-ink-0 mb-s-7">
              Why schools choose us.
            </h2>
            <div className="grid md:grid-cols-2 gap-s-5">
              <Reason
                eyebrow="No IT team required"
                title="Set up in one afternoon."
                body="Onboarding takes a single afternoon. We import your pupil list, train your staff in 90 minutes, and you're live by Monday."
              />
              <Reason
                eyebrow="Offline-first"
                title="Works when the network doesn't."
                body="Every register, score, and payment saves locally first and syncs in the background when the network returns. Lost data is not a thing."
              />
              <Reason
                eyebrow="Honest pricing"
                title="Naira. Fixed. No FX surprises."
                body="Our African curriculum prices stay denominated in Naira. The number on the screen is the number on your bank statement."
              />
              <Reason
                eyebrow="Built to scale"
                title="From 80 pupils to 8,000."
                body="A single school, a multi-campus group, or a network — the same platform scales without re-platforming."
              />
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-s-10">
          <div className="max-w-[900px] mx-auto px-s-6 lg:px-s-9 text-center">
            <h2 className="font-display text-display-2 text-ink-0">Ready when you are.</h2>
            <p className="mt-s-4 text-body-l text-ink-2 max-w-[55ch] mx-auto">
              A 30-minute demo. Your questions answered. Real screens, real
              data. No slide decks.
            </p>
            <div className="mt-s-7 flex flex-wrap justify-center gap-s-4">
              <a href={DEMO_MAILTO}>
                <Button intent="primary" size="lg">Book a Demo →</Button>
              </a>
              <Link to="/pricing">
                <Button intent="ghost" size="lg">See pricing →</Button>
              </Link>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}

function Feature({ title, body }) {
  return (
    <article className="bg-surface-2 border border-line-1 rounded-r-3 p-s-7">
      <h3 className="font-display text-display-3 text-ink-0">{title}</h3>
      <p className="mt-s-3 text-body text-ink-2">{body}</p>
    </article>
  );
}

function Reason({ eyebrow, title, body }) {
  return (
    <article className="bg-surface-2 border border-line-1 rounded-r-3 p-s-7">
      <div className="font-mono text-eyebrow uppercase text-gold-400">{eyebrow}</div>
      <h3 className="mt-s-3 font-display text-display-3 text-ink-0">{title}</h3>
      <p className="mt-s-3 text-body text-ink-2">{body}</p>
    </article>
  );
}
