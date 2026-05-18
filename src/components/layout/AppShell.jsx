/**
 * src/components/layout/AppShell.jsx
 *
 * The chrome that wraps every authenticated app surface.
 *
 * LAYOUT (design system §06 — mobile-first)
 * ──────────────────────────────────────────
 *   Desktop (lg+) : sidebar 240px left + main content right. Unchanged.
 *   Mobile (<lg)  : top header + scrollable main + sticky bottom nav bar.
 *
 * BOTTOM NAV (mobile only)
 * ─────────────────────────
 * AppShell renders a bottom nav from the navItems prop. Every surface passes
 * its full nav list; AppShell decides which items go in the primary 4 tabs
 * and which overflow into a "More" sheet.
 *
 * PRIMARY TABS — first 3 navItems + "More" tab if there are 4+ items.
 * If there are 3 or fewer items, all render as primary tabs (no More).
 *
 * MORE SHEET — slides up from bottom when the More tab is tapped. Shows
 * the remaining nav items in a list. Dismisses on overlay tap or item tap.
 *
 * SAFE-AREA PADDING
 * ──────────────────
 * The bottom nav uses `padding-bottom: env(safe-area-inset-bottom)` to
 * clear notched screens (iPhone X+, many Tecno/Samsung flagships).
 * Main content has matching bottom padding on mobile so content is never
 * hidden behind the nav bar.
 *
 * ICON STRATEGY
 * ─────────────
 * No icon library in the project (would add ~40 KB). Icons are inline SVG
 * path data — 20×20 viewBox, 1.5px stroked, matching the design system's
 * "geometric, minimal" illustration style. Each icon is a pure function
 * returning an SVG element. Paths are hand-tuned, not auto-generated.
 *
 * ADDING A NEW SURFACE
 * ─────────────────────
 * AppShell is surface-agnostic. Just pass navItems — the first 3 become
 * primary tabs, the rest go in More. No changes to AppShell needed.
 * To give a surface custom icons, add an entry to NAV_ICONS below.
 */

import { useState, useEffect } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { SyncPill } from '@/components/ui/SyncPill';
import { Mark, Wordmark } from '@/components/brand';
import { cn } from '@/utils/cn';

// ── Inline SVG icons ──────────────────────────────────────────────────────────
// 20×20 viewBox, 1.5px stroke, rounded caps/joins.

function IconHome() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" aria-hidden="true">
      <path d="M3 8.5L10 3l7 5.5V17a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M7.5 18v-5.5h5V18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconCheckSquare() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" aria-hidden="true">
      <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6.5 10l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconBarChart() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" aria-hidden="true">
      <rect x="3" y="10" width="3.5" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="8.25" y="6" width="3.5" height="11" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="13.5" y="3" width="3.5" height="14" rx="1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconBook() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" aria-hidden="true">
      <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3h10v14H5.5A1.5 1.5 0 0 1 4 15.5v-11Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 15.5A1.5 1.5 0 0 0 5.5 17H15.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8 7h5M8 10h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconStar() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" aria-hidden="true">
      <path d="M10 2.5l2.2 4.5 5 .7-3.6 3.5.85 5L10 13.8l-4.45 2.4.85-5L2.8 7.7l5-.7L10 2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function IconMap() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" aria-hidden="true">
      <path d="M7.5 3L2.5 5v12l5-2 5 2 5-2V3l-5 2-5-2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M7.5 3v12M12.5 5v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconClipboard() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" aria-hidden="true">
      <rect x="4" y="4" width="12" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7.5 4V3.5A.5.5 0 0 1 8 3h4a.5.5 0 0 1 .5.5V4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 9h6M7 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" aria-hidden="true">
      <circle cx="8" cy="7" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 17c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M13.5 5a2.5 2.5 0 0 1 0 5M18 17c0-2.8-2-5.1-4.5-5.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconAlert() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" aria-hidden="true">
      <path d="M10 3L2 17h16L10 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M10 9v3M10 14.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconGlobe() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" aria-hidden="true">
      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 2.5c-2 2.5-3 4.8-3 7.5s1 5 3 7.5M10 2.5c2 2.5 3 4.8 3 7.5s-1 5-3 7.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2.5 10h15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconMessage() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" aria-hidden="true">
      <path d="M3 4.5A1.5 1.5 0 0 1 4.5 3h11A1.5 1.5 0 0 1 17 4.5v8A1.5 1.5 0 0 1 15.5 14H7l-4 3V4.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function IconCurrency() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" aria-hidden="true">
      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 5.5v9M7.5 7.5c0-1.1 1.1-2 2.5-2s2.5.9 2.5 2-1.1 2-2.5 2-2.5.9-2.5 2 1.1 2 2.5 2 2.5-.9 2.5-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconWhatsApp() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" aria-hidden="true">
      <path d="M3 17l1.15-3.5A7 7 0 1 1 17 10a7 7 0 0 1-9.5 6.5L3 17Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M7.5 8.5c.5 1 1.2 1.8 2 2.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconSubscribe() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" aria-hidden="true">
      <path d="M10 3v14M3 10h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconGrid() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" aria-hidden="true">
      <rect x="3" y="3" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="3" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="3" y="11" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="11" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconMore() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" aria-hidden="true">
      <circle cx="5" cy="10" r="1.5" fill="currentColor" />
      <circle cx="10" cy="10" r="1.5" fill="currentColor" />
      <circle cx="15" cy="10" r="1.5" fill="currentColor" />
    </svg>
  );
}

function IconSchool() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" aria-hidden="true">
      <path d="M2 18V9l8-6 8 6v9" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <rect x="7.5" y="12" width="5" height="6" rx="0.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 3v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconTrending() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" aria-hidden="true">
      <path d="M2 14l5-5 4 4 7-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 6h4v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconDollar() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" aria-hidden="true">
      <rect x="2.5" y="5.5" width="15" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="10" cy="10.5" r="2.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconChild() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" aria-hidden="true">
      <circle cx="10" cy="6" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 18c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconPricing() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" aria-hidden="true">
      <path d="M3 10.5L10.5 3l6.5 6.5-7.5 7.5L3 10.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="13" cy="7" r="1.5" fill="currentColor" />
    </svg>
  );
}

function IconTutor() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" aria-hidden="true">
      <circle cx="10" cy="6.5" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 18c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M15 11l1.5 1.5L18 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Icon map — keyed by nav item label (lower-cased) ──────────────────────────
// Add any new surface labels here. Falls back to <IconGrid /> if not found.
const NAV_ICONS = {
  // Teacher
  'dashboard':   <IconHome />,
  'attendance':  <IconCheckSquare />,
  'gradebook':   <IconBarChart />,
  'reports':     <IconClipboard />,
  'comms':       <IconMessage />,
  // Parent
  'tonight':     <IconHome />,
  'children':    <IconChild />,
  'lessons':     <IconBook />,
  'messages':    <IconMessage />,
  'fees':        <IconCurrency />,
  'whatsapp':    <IconWhatsApp />,
  'subscribe':   <IconSubscribe />,
  // Student
  'today':       <IconHome />,
  'roadmap':     <IconMap />,
  'library':     <IconBook />,
  'badges':      <IconStar />,
  // Admin / Super
  'overview':    <IconHome />,
  'enrolments':  <IconUsers />,
  'staff':       <IconUsers />,
  'connections': <IconUsers />,
  'curriculum':  <IconBook />,
  'terms':       <IconClipboard />,
  'alerts':      <IconAlert />,
  'impact':      <IconTrending />,
  'billing':     <IconCurrency />,
  'schools':     <IconSchool />,
  'users':       <IconUsers />,
  'tutors':      <IconTutor />,
  'pricing':     <IconPricing />,
  'revenue':     <IconDollar />,
};

function getIcon(label) {
  return NAV_ICONS[label.toLowerCase()] ?? <IconGrid />;
}

// ── AppShell ──────────────────────────────────────────────────────────────────

export function AppShell({ navItems = [], children, title }) {
  const { profile, schoolName, signOut } = useAuth();
  const navigate  = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);

  // Close More sheet on route change
  const location = useLocation();
  useEffect(() => { setMoreOpen(false); }, [location.pathname]);

  const onSignOut = async () => {
    await signOut();
    navigate('/');
  };

  // Split nav into primary tabs (max 3) + overflow
  const hasManyItems  = navItems.length > 3;
  const primaryItems  = hasManyItems ? navItems.slice(0, 3) : navItems;
  const overflowItems = hasManyItems ? navItems.slice(3) : [];

  return (
    <div className="min-h-dvh bg-surface-1 text-ink-1 flex">

      {/* ── Desktop sidebar (lg+) ─────────────────────────────────────────── */}
      <aside className="hidden lg:flex w-[240px] shrink-0 bg-surface-2 border-r border-line-1 flex-col">
        <div className="p-s-6 border-b border-line-1">
          <Link to="/" className="flex items-start gap-s-3 group" aria-label="Train To Teach Africa — home">
            <Mark size={28} variant="gold" surfaceColor="#13162a" className="mt-[2px] shrink-0" />
            <Wordmark size="sm" className="!flex-col !gap-x-0 !leading-[1.0]" />
          </Link>
          {schoolName && (
            <div className="mt-s-3 font-mono text-meta text-ink-3 truncate">{schoolName}</div>
          )}
        </div>
        <nav className="p-s-4 flex flex-col gap-s-1 flex-1" aria-label="Main navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => cn(
                'px-s-4 py-s-3 rounded-r-2 text-[13.5px] flex items-center gap-s-3',
                isActive
                  ? 'bg-surface-3 text-ink-0 border border-line-2'
                  : 'text-ink-2 hover:text-ink-0 hover:bg-surface-3/50 border border-transparent',
              )}
            >
              <span className="opacity-60 shrink-0">{getIcon(item.label)}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-s-4 border-t border-line-1">
          <div className="flex items-center gap-s-3 px-s-4 py-s-3 mb-s-1">
            <Avatar name={profile?.full_name} />
            <div className="min-w-0">
              <div className="text-[13px] text-ink-1 truncate">{profile?.full_name}</div>
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
                {profile?.role?.replace(/_/g, ' ')}
              </div>
            </div>
          </div>
          <button
            onClick={onSignOut}
            className="w-full text-left px-s-4 py-s-3 rounded-r-2 text-[13px] text-ink-3 hover:text-ink-0 hover:bg-surface-3/50"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content area ─────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col">

        {/* Sticky top header */}
        <header className="border-b border-line-1 bg-surface-1/85 backdrop-blur-md sticky top-0 z-40">
          <div className="px-s-5 lg:px-s-9 h-[56px] lg:h-[64px] flex items-center justify-between">
            <h1 className="font-heading text-[17px] lg:text-[20px] font-semibold text-ink-0">{title}</h1>
            <div className="flex items-center gap-s-3 lg:gap-s-4">
              <SyncPill />
              {/* Profile avatar — hidden on very small screens, shown md+ */}
              <div className="hidden md:flex items-center gap-s-3">
                <div className="text-right leading-tight">
                  <div className="text-[13px] text-ink-1">{profile?.full_name}</div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
                    {profile?.role?.replace(/_/g, ' ')}
                  </div>
                </div>
                <Avatar name={profile?.full_name} />
              </div>
            </div>
          </div>
        </header>

        {/*
          Main scrollable region.
          pb-[calc(4.5rem+env(safe-area-inset-bottom))] on mobile ensures
          content isn't hidden behind the 72px bottom nav bar on any device.
        */}
        <main className={cn(
          'flex-1 px-s-5 lg:px-s-9 py-s-6 lg:py-s-7',
          navItems.length > 0 && 'pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-s-7',
        )}>
          {children}
        </main>
      </div>

      {/* ── Mobile bottom nav (< lg) ──────────────────────────────────────── */}
      {navItems.length > 0 && (
        <>
          <nav
            aria-label="Bottom navigation"
            className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-surface-2/95 backdrop-blur-md border-t border-line-2"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="flex items-stretch h-[56px]">
              {/* Primary tabs */}
              {primaryItems.map((item) => (
                <BottomTab key={item.to} item={item} />
              ))}

              {/* More tab */}
              {overflowItems.length > 0 && (
                <button
                  onClick={() => setMoreOpen((v) => !v)}
                  aria-expanded={moreOpen}
                  aria-controls="more-sheet"
                  className={cn(
                    'flex-1 flex flex-col items-center justify-center gap-[3px] transition-colors duration-150',
                    moreOpen ? 'text-gold-400' : 'text-ink-3',
                  )}
                >
                  <IconMore />
                  <span className="font-mono text-[10px] tracking-[0.06em]">More</span>
                </button>
              )}
            </div>
          </nav>

          {/* ── More sheet ────────────────────────────────────────────── */}
          {moreOpen && (
            <>
              {/* Backdrop */}
              <div
                className="lg:hidden fixed inset-0 z-40 bg-surface-0/70 backdrop-blur-sm"
                onClick={() => setMoreOpen(false)}
                aria-hidden="true"
              />

              {/* Sheet */}
              <div
                id="more-sheet"
                role="dialog"
                aria-label="More navigation options"
                className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-surface-2 border-t border-line-2 rounded-t-r-4"
                style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
              >
                {/* Sheet handle */}
                <div className="flex justify-center pt-s-3 pb-s-1">
                  <div className="w-[36px] h-[4px] rounded-full bg-line-3" />
                </div>

                {/* Overflow items */}
                <div className="p-s-4 grid grid-cols-4 gap-s-3">
                  {overflowItems.map((item) => (
                    <MoreSheetItem
                      key={item.to}
                      item={item}
                      onClose={() => setMoreOpen(false)}
                    />
                  ))}
                </div>

                {/* Sign out — always at the bottom of the sheet */}
                <div className="mx-s-4 mb-s-4 border-t border-line-1 pt-s-4">
                  <button
                    onClick={onSignOut}
                    className="w-full text-left px-s-4 py-s-3 rounded-r-2 text-[14px] text-ink-3 hover:text-ink-0 hover:bg-surface-3/50"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ── Bottom tab item ───────────────────────────────────────────────────────────

function BottomTab({ item }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) => cn(
        'flex-1 flex flex-col items-center justify-center gap-[3px] transition-colors duration-150',
        isActive ? 'text-gold-400' : 'text-ink-3 hover:text-ink-1',
      )}
    >
      {({ isActive }) => (
        <>
          <span className={cn('transition-transform duration-150', isActive && 'scale-110')}>
            {getIcon(item.label)}
          </span>
          <span className="font-mono text-[10px] tracking-[0.06em]">{item.label}</span>
          {/* Active indicator dot */}
          {isActive && (
            <span className="absolute bottom-[env(safe-area-inset-bottom,0px)] mt-auto">
              {/* Handled by text-gold-400 colour — no separate dot needed */}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

// ── More sheet item ───────────────────────────────────────────────────────────

function MoreSheetItem({ item, onClose }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onClose}
      className={({ isActive }) => cn(
        'flex flex-col items-center gap-s-2 p-s-3 rounded-r-3 text-center transition-colors duration-150',
        isActive
          ? 'bg-surface-3 text-gold-400 border border-line-2'
          : 'text-ink-2 hover:text-ink-0 hover:bg-surface-3/60',
      )}
    >
      {getIcon(item.label)}
      <span className="font-mono text-[10px] tracking-[0.06em] leading-tight">{item.label}</span>
    </NavLink>
  );
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ name = '' }) {
  const initials = name.split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('') || '?';
  return (
    <div
      className="w-[32px] h-[32px] lg:w-[36px] lg:h-[36px] rounded-full bg-gold-400/15 border border-gold-400/30 grid place-items-center font-mono text-[12px] text-gold-200 shrink-0"
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}
