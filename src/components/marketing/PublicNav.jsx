/**
 * src/components/marketing/PublicNav.jsx
 *
 * The marketing site nav. Sticky, blurs on scroll, mobile drawer on small.
 */

import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/brand';
import { cn } from '@/utils/cn';

const LINKS = [
  { to: '/solutions/schools', label: 'For Schools' },
  { to: '/solutions/parents', label: 'For Parents' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/about', label: 'About' },
];

export function PublicNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'fixed top-0 inset-x-0 z-50 transition-all duration-150',
        scrolled
          ? 'bg-surface-1/80 backdrop-blur-md border-b border-line-1'
          : 'bg-transparent border-b border-transparent',
      )}
    >
      <div className="max-w-[1280px] mx-auto px-s-6 lg:px-s-9 h-[64px] flex items-center justify-between">
        <Link to="/" className="flex items-center text-ink-0" aria-label="Train To Teach Africa — home">
          <Logo size="sm" surfaceColor="#0d0f1a" />
        </Link>

        <nav className="hidden lg:flex items-center gap-s-7">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) => cn(
                'text-[13.5px] text-ink-2 hover:text-ink-0 transition-colors duration-150',
                isActive && 'text-ink-0',
              )}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-s-3">
          <Link to="/sign-in" className="text-[13.5px] text-ink-2 hover:text-ink-0 px-s-3 py-s-2">
            Sign in
          </Link>
          <Link to="/sign-up">
            <Button intent="primary" size="sm">Start learning</Button>
          </Link>
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          className="lg:hidden p-s-3 text-ink-1 -mr-s-2"
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          {open ? <CloseIcon /> : <MenuIcon />}
        </button>
      </div>

      {open && (
        <div className="lg:hidden bg-surface-2 border-t border-line-1">
          <nav className="px-s-6 py-s-5 flex flex-col gap-s-4">
            {LINKS.map((l) => (
              <Link key={l.to} to={l.to} className="text-ink-1 text-[15px] py-s-2" onClick={() => setOpen(false)}>
                {l.label}
              </Link>
            ))}
            <div className="pt-s-4 border-t border-line-1 flex flex-col gap-s-3">
              <Link to="/sign-in" onClick={() => setOpen(false)}>
                <Button intent="ghost" size="md" className="w-full justify-center">Sign in</Button>
              </Link>
              <Link to="/sign-up" onClick={() => setOpen(false)}>
                <Button intent="primary" size="md" className="w-full justify-center">Start learning</Button>
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

function MenuIcon() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>; }
function CloseIcon() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>; }
