/**
 * src/pages/public/SolutionsSchoolsPage.jsx
 */

import { Link } from 'react-router-dom';
import { PublicNav } from '@/components/marketing/PublicNav';
import { PublicFooter } from '@/components/marketing/PublicFooter';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';

export default function SolutionsSchoolsPage() {
  return (
    <div className="min-h-dvh bg-surface-1 text-ink-1">
      <PublicNav />
      <main className="pt-[64px]">
        <section className="border-b border-line-1 py-s-10">
          <div className="max-w-[1280px] mx-auto px-s-6 lg:px-s-9">
            <Chip variant="gold" dot>For Schools</Chip>
            <h1 className="mt-s-5 font-display text-display-1 text-ink-0 max-w-[18ch]">
              School operations, finally on <span className="ital-gold">one screen.</span>
            </h1>
            <p className="mt-s-7 text-body-l text-ink-2 max-w-[60ch]">
              TTA SIMS gives proprietors and head teachers attendance,
              grading, term reports, parent comms, and billing — without
              hiring an IT department.
            </p>
            <div className="mt-s-7 flex flex-wrap gap-s-4">
              <a href="mailto:schools@traintoteachafrica.org?subject=School%20demo">
                <Button intent="primary" size="lg">Book a school demo</Button>
              </a>
              <Link to="/pricing"><Button intent="ghost" size="lg">See pricing →</Button></Link>
            </div>
          </div>
        </section>

        <section className="border-b border-line-1 py-s-10">
          <div className="max-w-[1280px] mx-auto px-s-6 lg:px-s-9">
            <h2 className="font-display text-display-2 text-ink-0 mb-s-7">What's in the bundle.</h2>
            <div className="grid md:grid-cols-3 gap-s-5">
              <Feature title="Attendance" body="One-tap class registers. Offline-safe. The teacher never loses a record because the network blinked." />
              <Feature title="Gradebook" body="Score entry that takes 4 minutes per class, not 40. Auto-rolls into term reports." />
              <Feature title="Term reports" body="A button. A PDF. A signed link to the parent. No copy-pasting from Excel." />
              <Feature title="Parent comms" body="Send notices via WhatsApp from the same place you took the register. No second app." />
              <Feature title="Billing" body="Track tuition, generate receipts, see who's behind. Paystack-powered." />
              <Feature title="CPD" body="In-context teacher development tied to this week's curriculum, not a Saturday workshop." />
            </div>
          </div>
        </section>

        <section className="py-s-10">
          <div className="max-w-[900px] mx-auto px-s-6 lg:px-s-9 text-center">
            <h2 className="font-display text-display-2 text-ink-0">Ready when you are.</h2>
            <p className="mt-s-4 text-body-l text-ink-2 max-w-[55ch] mx-auto">
              Onboarding takes a single afternoon. We import your pupil list,
              train your staff in 90 minutes, and you're live by Monday.
            </p>
            <div className="mt-s-7">
              <a href="mailto:schools@traintoteachafrica.org?subject=School%20demo">
                <Button intent="primary" size="lg">Book a demo →</Button>
              </a>
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
