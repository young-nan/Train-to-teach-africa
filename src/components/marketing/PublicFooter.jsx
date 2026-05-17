/**
 * src/components/marketing/PublicFooter.jsx
 *
 * Site-wide footer. Implements the official approved footer copy:
 *
 *   - Tagline block (left, takes 2 cols)
 *   - Platform · Company · Resources · Contact (right, 4 cols on lg)
 *   - Bottom strip with copyright + closing statement
 *
 * Resource & company links that don't yet have dedicated routes are deliberately
 * pointed at the closest existing surface (e.g. Curriculum Support → /about,
 * Parent Guides → /solutions/parents) so the footer never produces a 404.
 * Replace these with real route targets as standalone pages ship.
 */

import { Link } from 'react-router-dom';

const COLS = [
  {
    title: 'Platform',
    links: [
      { to: '/solutions/parents', label: 'TTA Learn' },
      { to: '/solutions/schools', label: 'TTA SIMS' },
      { to: '/tutors',            label: 'Tutor Network' },
      { to: '/solutions/parents', label: 'Parent Support' },
      { to: '/solutions/schools', label: 'School Solutions' },
    ],
  },
  {
    title: 'Company',
    links: [
      { to: '/about',          label: 'About Us' },
      { to: '/about',          label: 'Our Vision' },
      { to: '/about#contact',  label: 'Partnerships' },
      { to: '/about#contact',  label: 'Careers' },
      { to: '/about#contact',  label: 'Contact' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { to: '/solutions/schools', label: 'Curriculum Support' },
      { to: '/solutions/parents', label: 'Parent Guides' },
      { to: '/solutions/schools', label: 'Teacher Resources' },
      { to: '/solutions/schools', label: 'School Implementation' },
      { to: '/about#contact',     label: 'Help Centre' },
    ],
  },
];

export function PublicFooter() {
  return (
    <footer className="bg-surface-2 border-t border-line-1 mt-s-10">
      <div className="max-w-[1280px] mx-auto px-s-6 lg:px-s-9 py-s-10 grid gap-s-9 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr]">

        {/* Brand block */}
        <div>
          <div className="font-display text-display-3 text-ink-0">Train To Teach Africa</div>
          <p className="mt-s-3 text-ink-2 text-[13.5px] max-w-[40ch]">
            Curriculum-aligned education technology built for African schools,
            families, and educators.
          </p>
          <div className="mt-s-5 font-mono text-meta tracking-[0.18em] uppercase text-ink-3">
            Lagos · Nigeria
          </div>
        </div>

        {/* Three link columns */}
        {COLS.map((c) => (
          <div key={c.title}>
            <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-4">{c.title}</div>
            <ul className="flex flex-col gap-s-3">
              {c.links.map((l) => (
                <li key={l.label}>
                  <Link to={l.to} className="text-ink-2 text-[13.5px] hover:text-ink-0">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {/* Contact column */}
        <div>
          <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-4">Contact</div>
          <ul className="flex flex-col gap-s-3 text-[13.5px]">
            <li className="text-ink-2">Lagos, Nigeria</li>
            <li>
              <a
                href="mailto:support@traintoteachafrica.org"
                className="text-ink-2 hover:text-ink-0 break-all"
              >
                support@traintoteachafrica.org
              </a>
            </li>
            <li>
              <a
                href="https://www.traintoteachafrica.org"
                target="_blank"
                rel="noreferrer"
                className="text-ink-2 hover:text-ink-0 break-all"
              >
                www.traintoteachafrica.org
              </a>
            </li>
          </ul>
        </div>
      </div>

      {/* Bottom strip */}
      <div className="border-t border-line-1">
        <div className="max-w-[1280px] mx-auto px-s-6 lg:px-s-9 py-s-5 flex justify-between flex-wrap gap-s-3 font-mono text-meta tracking-[0.04em] text-ink-3">
          <span>© {new Date().getFullYear()} Train To Teach Africa</span>
          <span>Built by African educators for African learners.</span>
        </div>
      </div>
    </footer>
  );
}
