/**
 * src/components/marketing/PublicFooter.jsx
 */

import { Link } from 'react-router-dom';

const COLS = [
  {
    title: 'Platform',
    links: [
      { to: '/solutions/schools', label: 'TTA SIMS' },
      { to: '/solutions/parents', label: 'TTA Learn' },
      { to: '/pricing', label: 'Pricing' },
    ],
  },
  {
    title: 'Company',
    links: [
      { to: '/about', label: 'About' },
      { to: '/about#impact', label: 'Impact' },
      { to: '/about#contact', label: 'Contact' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { to: '/sign-in', label: 'Sign in' },
      { to: '/sign-up', label: 'Create account' },
      { to: '/student-sign-in', label: 'Student PIN login' },
    ],
  },
];

export function PublicFooter() {
  return (
    <footer className="bg-surface-2 border-t border-line-1 mt-s-10">
      <div className="max-w-[1280px] mx-auto px-s-6 lg:px-s-9 py-s-10 grid gap-s-9 lg:grid-cols-[2fr_1fr_1fr_1fr]">
        <div>
          <div className="font-display text-display-3 text-ink-0">Train To Teach Africa</div>
          <p className="mt-s-3 text-ink-2 text-[13.5px] max-w-[40ch]">
            Curriculum-aligned digital learning and school management
            infrastructure built specifically for African classrooms.
          </p>
          <div className="mt-s-5 font-mono text-meta tracking-[0.18em] uppercase text-ink-3">
            Lagos · Nigeria
          </div>
        </div>
        {COLS.map((c) => (
          <div key={c.title}>
            <div className="font-mono text-eyebrow uppercase text-gold-400 mb-s-4">{c.title}</div>
            <ul className="flex flex-col gap-s-3">
              {c.links.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="text-ink-2 text-[13.5px] hover:text-ink-0">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line-1">
        <div className="max-w-[1280px] mx-auto px-s-6 lg:px-s-9 py-s-5 flex justify-between flex-wrap gap-s-3 font-mono text-meta tracking-[0.04em] text-ink-3">
          <span>© {new Date().getFullYear()} Train To Teach Africa</span>
          <span>Built in Lagos, for Africa.</span>
        </div>
      </div>
    </footer>
  );
}
