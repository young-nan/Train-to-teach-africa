/**
 * src/components/layout/AuthLayout.jsx
 *
 * Two-column layout for sign-in / sign-up pages.
 * Brand panel on the left (desktop only), form on the right.
 */

import { Link } from 'react-router-dom';
import { Logo } from '@/components/brand';

export function AuthLayout({ title, subtitle, footer, children }) {
  return (
    <div className="min-h-dvh bg-surface-1 grid lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel */}
      <aside className="hidden lg:flex flex-col justify-between p-s-10 bg-surface-2 border-r border-line-1 relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none opacity-50"
          style={{ background: 'radial-gradient(ellipse 70% 50% at 30% 20%, rgba(229,166,42,.12), transparent 60%)' }}
          aria-hidden="true"
        />
        <Link to="/" className="relative" aria-label="Train To Teach Africa — home">
          <Logo size="md" surfaceColor="#13162a" />
        </Link>
        <div className="relative">
          <p className="font-display text-display-2 text-ink-0 leading-tight max-w-[18ch]">
            The operating system for <span className="ital-gold">African education.</span>
          </p>
          <p className="mt-s-5 text-body text-ink-2 max-w-[42ch]">
            Built specifically for African classrooms — offline-first,
            mobile-first, curriculum-aligned.
          </p>
        </div>
        <div className="relative font-mono text-meta text-ink-3 tracking-[0.04em]">
          Lagos · Nigeria
        </div>
      </aside>

      {/* Form panel */}
      <div className="flex flex-col">
        <header className="px-s-7 py-s-5 border-b border-line-1">
          <Link to="/" className="lg:hidden inline-flex" aria-label="Train To Teach Africa — home">
            <Logo size="sm" surfaceColor="#0d0f1a" />
          </Link>
        </header>
        <main className="flex-1 grid place-items-center px-s-6 py-s-9">
          <div className="w-full max-w-[440px]">
            <h1 className="font-display text-display-2 text-ink-0">{title}</h1>
            {subtitle && <p className="mt-s-3 text-body text-ink-2">{subtitle}</p>}
            <div className="mt-s-7">{children}</div>
            {footer && <div className="mt-s-7 pt-s-5 border-t border-line-1 text-[13.5px] text-ink-3">{footer}</div>}
          </div>
        </main>
      </div>
    </div>
  );
}
