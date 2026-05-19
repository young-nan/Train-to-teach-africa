/**
 * src/pages/public/TermsPage.jsx
 *
 * /terms
 *
 * Terms of Use for Train To Teach Africa.
 * Covers schools, parents, teachers, students, and tutors.
 */

import { Link } from 'react-router-dom';
import { PublicNav } from '@/components/marketing/PublicNav';
import { PublicFooter } from '@/components/marketing/PublicFooter';
import { Chip } from '@/components/ui/Chip';

const EFFECTIVE_DATE = 'January 2025';
const CONTACT_EMAIL  = 'hello@traintoteachafrica.org';

export default function TermsPage() {
  return (
    <div className="min-h-dvh bg-surface-1 text-ink-1">
      <PublicNav />
      <main className="pt-[64px]">
        <section className="border-b border-line-1 py-s-10">
          <div className="max-w-[860px] mx-auto px-s-6 lg:px-s-9">
            <Chip variant="default" dot>Terms of Use</Chip>
            <h1 className="mt-s-5 font-display text-display-1 text-ink-0 max-w-[22ch]">
              Using TTA{' '}
              <span className="ital-gold">responsibly.</span>
            </h1>
            <p className="mt-s-6 text-body-l text-ink-2 max-w-[60ch]">
              These terms govern your use of Train To Teach Africa's products and services.
              By creating an account, you agree to these terms.
            </p>
            <div className="mt-s-5 font-mono text-meta text-ink-3">
              Effective: {EFFECTIVE_DATE}
            </div>
          </div>
        </section>

        <div className="max-w-[860px] mx-auto px-s-6 lg:px-s-9 py-s-10 space-y-s-10">

          <Clause title="1. Who we are">
            <p>
              Train To Teach Africa ("TTA", "we", "us") provides educational technology
              services including a school information management system (TTA SIMS) and a
              student learning platform (TTA Learn). TTA is based in Lagos, Nigeria.
            </p>
          </Clause>

          <Clause title="2. Your account">
            <p>You are responsible for:</p>
            <ul>
              <li>Keeping your password secure and confidential</li>
              <li>All actions taken under your account</li>
              <li>Ensuring the accuracy of information you provide</li>
              <li>Notifying us immediately of any unauthorised access</li>
            </ul>
            <p>
              You must be at least 18 years old to create an account. Student accounts
              are PIN-based and created by schools on behalf of enrolled pupils.
            </p>
          </Clause>

          <Clause title="3. School terms">
            <p>Schools using TTA agree to:</p>
            <ul>
              <li>Only enrol pupils for whom the school has appropriate authority</li>
              <li>Obtain parental consent before connecting parents to pupil records</li>
              <li>Use TTA solely for legitimate educational administration</li>
              <li>Not share login credentials with unauthorised persons</li>
              <li>Notify TTA promptly if a staff member leaves or is suspended</li>
            </ul>
            <p>
              Schools retain ownership of all operational data entered into TTA SIMS.
              TTA processes this data as a data processor on the school's behalf.
            </p>
          </Clause>

          <Clause title="4. Parent terms">
            <p>Parents using TTA agree to:</p>
            <ul>
              <li>Only connect to their own children's school records</li>
              <li>Use TTA Learn content solely for their child's personal learning</li>
              <li>Not share subscription access with unrelated households</li>
              <li>Keep student PIN codes confidential</li>
            </ul>
          </Clause>

          <Clause title="5. Tutor terms">
            <p>Tutors listed on TTA agree to:</p>
            <ul>
              <li>Provide accurate credentials and availability information</li>
              <li>Comply with TTA's tutor verification and guarantor requirements</li>
              <li>Conduct sessions professionally and safely</li>
              <li>Not misuse parent or student contact information shared through bookings</li>
              <li>Respect TTA's session and payment policies</li>
            </ul>
            <p>
              TTA reserves the right to remove a tutor listing for any breach of these terms
              or conduct unbecoming of an educator.
            </p>
          </Clause>

          <Clause title="6. Prohibited uses">
            <p>You must not:</p>
            <ul>
              <li>Use TTA to harass, bully, or harm any pupil, parent, or teacher</li>
              <li>Attempt to access accounts or data that do not belong to you</li>
              <li>Scrape, copy, or redistribute TTA content or lesson material</li>
              <li>Use TTA to send unsolicited commercial messages</li>
              <li>Reverse-engineer, decompile, or tamper with any TTA software</li>
              <li>Use TTA in ways that violate Nigerian law or applicable regulations</li>
            </ul>
          </Clause>

          <Clause title="7. Intellectual property">
            <p>
              All lesson content, curriculum materials, and platform designs are owned
              by TTA or licensed to TTA. Schools may use curriculum content solely within
              TTA's platform for enrolled pupils. No content may be copied, redistributed,
              or sold outside TTA without written permission.
            </p>
            <p>
              Schools retain full ownership of all data they enter — attendance records,
              pupil rosters, assessment scores, and reports.
            </p>
          </Clause>

          <Clause title="8. Payments and subscriptions">
            <p>
              Subscriptions are billed through Paystack in Nigerian Naira (NGN) or
              US Dollars (USD) depending on your plan. Prices are shown on the{' '}
              <Link to="/pricing" className="text-gold-200 hover:text-gold-50">Pricing page</Link>.
            </p>
            <p>
              Subscriptions renew automatically. You may cancel at any time from your
              account settings; cancellation takes effect at the end of the current
              billing period. Refunds are at TTA's discretion and subject to the
              circumstances of the request.
            </p>
          </Clause>

          <Clause title="9. Service availability">
            <p>
              TTA aims for high availability but cannot guarantee uninterrupted service.
              We are not liable for losses arising from downtime, data delays, or
              third-party service failures (including Supabase, Paystack, or WhatsApp Business API).
            </p>
          </Clause>

          <Clause title="10. Limitation of liability">
            <p>
              To the maximum extent permitted by Nigerian law, TTA's liability to any user
              is limited to the subscription fees paid in the 12 months preceding the claim.
              TTA is not liable for indirect, incidental, or consequential damages.
            </p>
          </Clause>

          <Clause title="11. Privacy">
            <p>
              Your use of TTA is governed by our{' '}
              <Link to="/privacy" className="text-gold-200 hover:text-gold-50">Privacy Policy</Link>,
              which is incorporated into these Terms by reference. We are committed to
              compliance with the Nigeria Data Protection Act (NDPA).
            </p>
          </Clause>

          <Clause title="12. Changes to these terms">
            <p>
              We may update these Terms. We will notify registered users by email of
              material changes at least 14 days before they take effect. Continued use
              of TTA after that date constitutes acceptance of the revised Terms.
            </p>
          </Clause>

          <Clause title="13. Governing law">
            <p>
              These Terms are governed by the laws of the Federal Republic of Nigeria.
              Any disputes shall be resolved in the courts of Lagos State, Nigeria.
            </p>
          </Clause>

          <div className="border-t border-line-2 pt-s-6">
            <p className="text-[13px] text-ink-3 mb-s-4">
              Questions about these Terms?{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-gold-200 hover:text-gold-50">
                {CONTACT_EMAIL}
              </a>
            </p>
            <div className="flex flex-wrap gap-s-4">
              <Link to="/privacy" className="text-[13px] text-gold-200 hover:text-gold-50">Privacy Policy →</Link>
              <Link to="/"        className="text-[13px] text-ink-3 hover:text-ink-1">← Back to home</Link>
            </div>
          </div>

        </div>
      </main>
      <PublicFooter />
    </div>
  );
}

function Clause({ title, children }) {
  return (
    <section className="scroll-mt-[80px]">
      <h2 className="font-display text-[22px] text-ink-0 mb-s-4">{title}</h2>
      <div className="space-y-s-3 text-[14px] text-ink-2 leading-relaxed [&_ul]:list-disc [&_ul]:list-inside [&_ul]:space-y-s-1 [&_ul]:text-[13px] [&_ul]:text-ink-3">
        {children}
      </div>
    </section>
  );
}
