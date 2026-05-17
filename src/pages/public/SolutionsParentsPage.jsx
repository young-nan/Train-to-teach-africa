/**
 * src/pages/public/SolutionsParentsPage.jsx
 *
 * Public marketing page targeted at parents. Implements the approved
 * "Parent Support" copy block: simple lesson summaries, downloadable guides,
 * nightly 5-minute activities, dinner discussion questions, progress
 * tracking, attendance visibility, and report card access.
 *
 * Voice: warm, practical, no jargon. Parents should never feel the platform
 * is asking them to become teachers.
 */

import { Link } from 'react-router-dom';
import { PublicNav } from '@/components/marketing/PublicNav';
import { PublicFooter } from '@/components/marketing/PublicFooter';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';

export default function SolutionsParentsPage() {
  return (
    <div className="min-h-dvh bg-surface-1 text-ink-1">
      <PublicNav />
      <main className="pt-[64px]">

        {/* Hero */}
        <section className="border-b border-line-1 py-s-10">
          <div className="max-w-[1280px] mx-auto px-s-6 lg:px-s-9">
            <Chip variant="gold" dot>For Parents</Chip>
            <h1 className="mt-s-5 font-display text-display-1 text-ink-0 max-w-[22ch]">
              Helping parents <span className="ital-gold">participate</span> in learning.
            </h1>
            <p className="mt-s-7 text-body-l text-ink-2 max-w-[64ch]">
              Many parents want to support their children academically but do
              not always know how. Train To Teach Africa helps bridge that gap —
              with simple lesson summaries, a 5-minute home activity each
              evening, and clear visibility into your child's learning.
            </p>
            <p className="mt-s-5 text-body-l text-ink-2 italic max-w-[60ch]">
              Learning should not stop when the child leaves the classroom.
            </p>
            <div className="mt-s-7 flex flex-wrap gap-s-4">
              <Link to="/sign-up"><Button intent="primary" size="lg">Start Learning</Button></Link>
              <Link to="/pricing"><Button intent="ghost" size="lg">See pricing →</Button></Link>
            </div>
          </div>
        </section>

        {/* What parents receive */}
        <section className="border-b border-line-1 py-s-10">
          <div className="max-w-[1280px] mx-auto px-s-6 lg:px-s-9">
            <h2 className="font-display text-display-2 text-ink-0 mb-s-7">
              What you receive.
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-s-5">
              <Item title="Simple lesson summaries"            body="What your child learned today, in plain English. No teacher-speak." />
              <Item title="Downloadable learning guides"        body="Print or save PDFs for the days the network is patchy or you want to work offline." />
              <Item title="Nightly 5-minute activities"         body="A quick thing to do during dinner prep. No special supplies. No printer required." />
              <Item title="Discussion questions"                body="Three dinner-table questions tied to today's lesson. Keeps the conversation flowing." />
              <Item title="Academic progress tracking"          body="One screen, three numbers, no jargon. We tell you when something needs attention." />
              <Item title="Attendance + report cards"           body="See who showed up and who didn't. Read the teacher's term comments the moment they're released." />
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="border-b border-line-1 py-s-10 bg-surface-2/40">
          <div className="max-w-[1280px] mx-auto px-s-6 lg:px-s-9">
            <h2 className="font-display text-display-2 text-ink-0 mb-s-7">How it works.</h2>
            <div className="grid md:grid-cols-3 gap-s-5">
              <Step n="01" title="Tell us your child's class." body="We align everything to the NERDC curriculum your child is actually learning." />
              <Step n="02" title="Get tonight's activity."     body="A 5-minute thing you can do during dinner prep. No printer needed. No special supplies." />
              <Step n="03" title="See progress."                body="One screen, three numbers, no jargon. We'll tell you when something needs attention." />
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-s-10">
          <div className="max-w-[900px] mx-auto px-s-6 lg:px-s-9 text-center">
            <h2 className="font-display text-display-2 text-ink-0">
              Start tonight.
            </h2>
            <p className="mt-s-4 text-body-l text-ink-2 max-w-[55ch] mx-auto">
              The first 5-minute activity is waiting. Set up takes two minutes
              and works on any phone.
            </p>
            <div className="mt-s-7 flex flex-wrap justify-center gap-s-4">
              <Link to="/sign-up"><Button intent="primary" size="lg">Start Learning</Button></Link>
              <Link to="/pricing"><Button intent="ghost" size="lg">See pricing →</Button></Link>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}

function Item({ title, body }) {
  return (
    <article className="bg-surface-2 border border-line-1 rounded-r-3 p-s-7">
      <h3 className="font-display text-display-3 text-ink-0">{title}</h3>
      <p className="mt-s-3 text-body text-ink-2">{body}</p>
    </article>
  );
}

function Step({ n, title, body }) {
  return (
    <article className="bg-surface-2 border border-line-1 rounded-r-3 p-s-7">
      <div className="font-mono text-eyebrow uppercase text-gold-400">Step {n}</div>
      <h3 className="mt-s-3 font-display text-display-3 text-ink-0">{title}</h3>
      <p className="mt-s-3 text-body text-ink-2">{body}</p>
    </article>
  );
}
