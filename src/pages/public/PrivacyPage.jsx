/**
 * src/pages/public/PrivacyPage.jsx
 *
 * /privacy
 *
 * Privacy Policy for Train To Teach Africa.
 * NDPA (Nigeria Data Protection Act) + GDPR-principle aligned.
 * Role-segmented: Schools · Parents · Teachers · Students.
 *
 * Last updated: 2025. Policy version: 1.
 */

import { usePageMeta } from '@/hooks/usePageMeta';
import { Link } from 'react-router-dom';
import { PublicNav } from '@/components/marketing/PublicNav';
import { PublicFooter } from '@/components/marketing/PublicFooter';
import { Chip } from '@/components/ui/Chip';

const EFFECTIVE_DATE = 'January 2025';
const POLICY_VERSION = '1.0';
const CONTACT_EMAIL  = 'privacy@traintoteachafrica.org';

export default function PrivacyPage() {
  usePageMeta('Privacy Policy', 'How Train To Teach Africa collects, uses, and protects your data.');
  return (
    <div className="min-h-dvh bg-surface-1 text-ink-1">
      <PublicNav />
      <main className="pt-[64px]">
        {/* Hero */}
        <section className="border-b border-line-1 py-s-10">
          <div className="max-w-[860px] mx-auto px-s-6 lg:px-s-9">
            <Chip variant="gold" dot>Privacy Policy</Chip>
            <h1 className="mt-s-5 font-display text-display-1 text-ink-0 max-w-[24ch]">
              Your data.{' '}
              <span className="ital-gold">Your control.</span>
            </h1>
            <p className="mt-s-6 text-body-l text-ink-2 max-w-[60ch]">
              Train To Teach Africa operates on a simple principle: schools own their operational
              data, parents own their family data, and TTA only processes data necessary to
              deliver educational services.
            </p>
            <div className="mt-s-5 flex flex-wrap gap-s-3 font-mono text-meta text-ink-3">
              <span>Effective: {EFFECTIVE_DATE}</span>
              <span>·</span>
              <span>Version {POLICY_VERSION}</span>
              <span>·</span>
              <span>NDPA-aligned</span>
            </div>
          </div>
        </section>

        {/* Content */}
        <div className="max-w-[860px] mx-auto px-s-6 lg:px-s-9 py-s-10 space-y-s-12">

          {/* Quick navigation */}
          <nav className="bg-surface-2 border border-line-2 rounded-r-3 p-s-6">
            <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-4">Sections</div>
            <div className="grid sm:grid-cols-2 gap-s-2">
              {[
                ['#what-we-collect',   'What we collect'],
                ['#what-we-dont-sell', "What we don't sell"],
                ['#schools',           'For schools'],
                ['#parents',           'For parents'],
                ['#teachers',          'For teachers'],
                ['#students',          'For students'],
                ['#your-rights',       'Your rights'],
                ['#contact',           'Contact us'],
              ].map(([href, label]) => (
                <a key={href} href={href}
                  className="text-[14px] text-gold-200 hover:text-gold-50 font-mono">
                  → {label}
                </a>
              ))}
            </div>
          </nav>

          {/* What we collect */}
          <Section id="what-we-collect" title="What we collect">
            <p>We collect only the data needed to deliver educational services to schools, teachers, parents, and students.</p>
            <DataTable rows={[
              ['Attendance records',        'Mark and track pupil attendance by class and date'],
              ['Assessment scores',         'Record and report on pupil academic performance'],
              ['Lesson engagement',         'Track which lessons a student started, completed, or replayed'],
              ['Report card data',          'Subject grades, conduct ratings, teacher comments'],
              ['Parent engagement activity','Lesson views, dinner question responses, WhatsApp delivery status'],
              ['Teacher classroom activity','Attendance entries, gradebook updates, comms notes'],
              ['Subscription / payment',    'Plan type, payment status, transaction reference via Paystack'],
              ['Device information',        'Browser type, screen size — only for platform optimisation'],
            ]} />
          </Section>

          {/* What we don't sell */}
          <Section id="what-we-dont-sell" title="What we never sell">
            <p className="font-medium text-ink-0">
              TTA does not sell, rent, or share personal data with advertisers or third-party marketers — ever.
            </p>
            <div className="mt-s-4 space-y-s-2">
              {[
                'Student identities, names, or photos',
                'Report card content or academic performance',
                'Parent personal information or contact details',
                'School internal records or pupil rosters',
                'Teacher notes or communication logs',
              ].map((item) => (
                <div key={item} className="flex items-start gap-s-3">
                  <span className="text-red-400 font-bold mt-[2px]">✕</span>
                  <span className="text-[14px] text-ink-1">{item}</span>
                </div>
              ))}
            </div>
          </Section>

          {/* Schools */}
          <Section id="schools" title="For schools">
            <RoleChip>School admins & head teachers</RoleChip>
            <h3 className="font-display text-display-3 text-ink-0 mt-s-4 mb-s-3">What we process on your behalf</h3>
            <p>When a school uses TTA SIMS, we act as a data processor on the school's behalf. The school is the data controller for all pupil and staff records.</p>
            <DataTable rows={[
              ['Pupil roster',            'Names, class, level, attendance history'],
              ['Assessment data',         'Scores, term reports, conduct ratings'],
              ['Staff records',           'Teacher accounts, class assignments'],
              ['Parent connections',      'Linked parent accounts, shared data scope'],
              ['School communications',   'Notes logged against pupils, WhatsApp delivery logs'],
            ]} />
            <h3 className="font-display text-display-3 text-ink-0 mt-s-6 mb-s-3">Consent choices</h3>
            <p>Beyond operational processing (required), schools can choose to participate in:</p>
            <ConsentList items={[
              ['Anonymised educational research', 'Optional — contribute anonymised trends to national educational insights'],
              ['Network benchmarking', 'Optional — allow anonymised comparison with other TTA schools'],
              ['TTA publications', 'Optional — allow TTA to reference your school in impact reports'],
              ['Media consent', 'Separate — photos/videos in TTA materials'],
            ]} />
            <p className="mt-s-4 text-[13px] text-ink-3">
              Manage your school's consent settings in{' '}
              <strong>School Settings → Data &amp; Privacy</strong>.
            </p>
          </Section>

          {/* Parents */}
          <Section id="parents" title="For parents">
            <RoleChip>Parents</RoleChip>
            <h3 className="font-display text-display-3 text-ink-0 mt-s-4 mb-s-3">What we process</h3>
            <DataTable rows={[
              ['Child learning data',      'Lesson engagement, assessment progress, report cards'],
              ['Home learning activity',   'Lesson views, dinner question responses, when opted in to WhatsApp digest'],
              ['Account information',      'Name, email, phone number (for WhatsApp delivery)'],
              ['Connection to school',     'Linked children, school data access scope'],
            ]} />
            <h3 className="font-display text-display-3 text-ink-0 mt-s-6 mb-s-3">Your consent choices</h3>
            <ConsentList items={[
              ['Child progress tracking', 'Required — needed for lessons, assessments, report cards'],
              ['Anonymised research', 'Optional — contribute to educational research without identifying your child'],
              ['Home learning research', 'Optional — your engagement with dinner questions and kitchen activities contributes anonymously to research on African home learning'],
            ]} />
            <p className="mt-s-4 text-[13px] text-ink-3">
              Manage your privacy choices in <strong>Account Settings → Privacy</strong>.
            </p>
          </Section>

          {/* Teachers */}
          <Section id="teachers" title="For teachers">
            <RoleChip>Teachers & head teachers</RoleChip>
            <DataTable rows={[
              ['Account information',     'Name, email — for school assignment and login'],
              ['Class activity',          'Attendance entries, gradebook updates, lesson marks'],
              ['Communications logs',     'Notes logged against pupils (visible to school admin)'],
              ['Approval actions',        'Report card submissions and approvals are audit-logged'],
            ]} />
            <p className="mt-s-4 text-[14px] text-ink-2">
              Teachers operate within the school's data control boundary. All teacher actions on pupil records are logged in the school audit trail and visible to the school admin.
            </p>
          </Section>

          {/* Students */}
          <Section id="students" title="For students">
            <RoleChip>Students (children)</RoleChip>
            <p className="text-[14px] text-ink-0 font-medium">
              TTA takes the protection of children's data extremely seriously.
            </p>
            <DataTable rows={[
              ['Learning progress',       'Lessons completed, assessment scores, badges earned'],
              ['Attendance',              'Presence / absence / late records — visible to parents and teachers'],
              ['Report cards',            'Published by the school; accessible to the linked parent'],
            ]} />
            <div className="bg-gold-400/10 border border-gold-400/25 rounded-r-2 px-s-5 py-s-4 mt-s-4">
              <p className="text-[14px] font-medium text-gold-200 mb-s-2">Child data protection</p>
              <ul className="text-[13px] text-ink-2 space-y-s-1 list-disc list-inside">
                <li>Student accounts are PIN-based — no email or personal details required</li>
                <li>Student data is never shared with third parties</li>
                <li>No advertising is shown to students</li>
                <li>Student photos are never collected by TTA</li>
                <li>Parental consent is required for any school connection</li>
              </ul>
            </div>
          </Section>

          {/* Anonymisation */}
          <Section id="anonymisation" title="Anonymisation &amp; research">
            <p>
              When schools or parents opt in to research participation, TTA applies strict anonymisation before any data enters the research layer:
            </p>
            <div className="grid sm:grid-cols-2 gap-s-4 mt-s-4">
              <div className="bg-red-400/10 border border-red-400/20 rounded-r-2 p-s-4">
                <div className="font-mono text-[11px] uppercase text-red-400 mb-s-2">Never included in research</div>
                {['Names', 'Email addresses', 'Phone numbers', 'Exact locations', 'Student photos', 'Exact school performance'].map((i) => (
                  <div key={i} className="text-[13px] text-ink-2">✕ {i}</div>
                ))}
              </div>
              <div className="bg-green-400/10 border border-green-400/20 rounded-r-2 p-s-4">
                <div className="font-mono text-[11px] uppercase text-green-400 mb-s-2">What research sees</div>
                {['State / region', 'Class level (e.g. Primary 3)', 'Subject', 'Score band (e.g. 40–50)', 'School type', 'Term'].map((i) => (
                  <div key={i} className="text-[13px] text-ink-2">✓ {i}</div>
                ))}
              </div>
            </div>
          </Section>

          {/* Your rights */}
          <Section id="your-rights" title="Your rights">
            <p>Under the Data Protection Act (DPA) and aligned with GDPR principles, you have the right to:</p>
            <div className="space-y-s-3 mt-s-4">
              {[
                ['Access',      'Request a copy of all personal data we hold about you.'],
                ['Correction',  'Request correction of inaccurate personal data.'],
                ['Deletion',    'Request deletion of your personal data (subject to legal and operational obligations).'],
                ['Portability', 'Request your data in a machine-readable format.'],
                ['Objection',   'Object to processing for research or direct communications.'],
                ['Withdrawal',  'Withdraw any optional consent at any time without affecting prior lawful processing.'],
              ].map(([title, body]) => (
                <div key={title} className="flex gap-s-4">
                  <div className="font-mono text-[12px] text-gold-400 w-[90px] shrink-0 mt-[2px]">{title}</div>
                  <div className="text-[14px] text-ink-2">{body}</div>
                </div>
              ))}
            </div>
            <p className="mt-s-5 text-[13px] text-ink-3">
              To exercise any of these rights, email{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-gold-200 hover:text-gold-50">{CONTACT_EMAIL}</a>.
              We will respond within 30 days.
            </p>
          </Section>

          {/* Contact */}
          <Section id="contact" title="Contact us">
            <p>
              If you have questions about this policy, a data request, or a concern about how your data is handled:
            </p>
            <div className="mt-s-4 bg-surface-2 border border-line-2 rounded-r-2 p-s-5 space-y-s-2">
              <div className="font-mono text-[13px]">
                <span className="text-ink-3">Email: </span>
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-gold-200">{CONTACT_EMAIL}</a>
              </div>
              <div className="font-mono text-[13px] text-ink-3">
                Train To Teach Africa · Lagos, Nigeria
              </div>
            </div>
            <p className="mt-s-4 text-[13px] text-ink-3">
              This policy may be updated. We will notify users of material changes by email and update the version number above. Continued use of TTA after a policy update constitutes acceptance.
            </p>
            <div className="mt-s-5 flex flex-wrap gap-s-4">
              <Link to="/terms" className="text-[13px] text-gold-200 hover:text-gold-50">Terms of Use →</Link>
              <Link to="/"     className="text-[13px] text-ink-3 hover:text-ink-1">← Back to home</Link>
            </div>
          </Section>

        </div>
      </main>
      <PublicFooter />
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ id, title, children }) {
  return (
    <section id={id} className="scroll-mt-[80px]">
      <h2 className="font-display text-display-2 text-ink-0 mb-s-5">{title}</h2>
      <div className="space-y-s-4 text-[14px] text-ink-2 leading-relaxed">
        {children}
      </div>
    </section>
  );
}

function RoleChip({ children }) {
  return (
    <span className="inline-block font-mono text-[11px] uppercase tracking-[0.14em] text-gold-400 border border-gold-400/30 px-s-3 py-[3px] rounded-full">
      {children}
    </span>
  );
}

function DataTable({ rows }) {
  return (
    <div className="mt-s-4 bg-surface-2 border border-line-1 rounded-r-2 overflow-hidden">
      {rows.map(([label, desc]) => (
        <div key={label} className="flex gap-s-4 px-s-4 py-s-3 border-b border-line-1 last:border-0">
          <div className="font-mono text-[12px] text-ink-1 font-medium w-[160px] shrink-0">{label}</div>
          <div className="text-[13px] text-ink-3">{desc}</div>
        </div>
      ))}
    </div>
  );
}

function ConsentList({ items }) {
  return (
    <div className="mt-s-3 space-y-s-3">
      {items.map(([title, desc]) => (
        <div key={title} className="flex gap-s-3">
          <span className="text-green-400 mt-[2px]">✓</span>
          <div>
            <div className="text-[14px] font-medium text-ink-1">{title}</div>
            <div className="text-[13px] text-ink-3">{desc}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
