/**
 * src/pages/public/SolutionsParentsPage.jsx
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
        <section className="border-b border-line-1 py-s-10">
          <div className="max-w-[1280px] mx-auto px-s-6 lg:px-s-9">
            <Chip variant="gold" dot>For Parents</Chip>
            <h1 className="mt-s-5 font-display text-display-1 text-ink-0 max-w-[20ch]">
              Help your child <span className="ital-gold">at home,</span> in five minutes.
            </h1>
            <p className="mt-s-7 text-body-l text-ink-2 max-w-[60ch]">
              We send you what your child learned today, a 5-minute kitchen
              activity, and three dinner questions. That's it. You don't have
              to be a teacher.
            </p>
            <div className="mt-s-7 flex flex-wrap gap-s-4">
              <Link to="/sign-up"><Button intent="primary" size="lg">Start a parent account</Button></Link>
              <Link to="/pricing"><Button intent="ghost" size="lg">See pricing →</Button></Link>
            </div>
          </div>
        </section>

        <section className="py-s-10">
          <div className="max-w-[1280px] mx-auto px-s-6 lg:px-s-9">
            <h2 className="font-display text-display-2 text-ink-0 mb-s-7">How it works.</h2>
            <div className="grid md:grid-cols-3 gap-s-5">
              <Step n="01" title="Tell us your child's class." body="We align everything to the NERDC curriculum your child is actually learning." />
              <Step n="02" title="Get tonight's activity." body="A 5-minute thing you can do during dinner prep. No printer needed. No special supplies." />
              <Step n="03" title="See progress." body="One screen, three numbers, no jargon. We'll tell you when something needs attention." />
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
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
