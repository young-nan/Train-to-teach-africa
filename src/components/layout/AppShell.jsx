/**
 * AppShell v3 — full redesign matching TTA EOS v2 design system
 *
 * Layout:
 *   Desktop: fixed 232px sidebar (left) + sticky 56px topbar + scrollable main
 *   Mobile:  sticky topbar + scrollable main + fixed bottom nav
 *
 * The sidebar and topbar both read --product-accent from CSS so they
 * automatically adapt to the current role surface.
 */

import { useState, useCallback } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/utils/cn';
import { supabase } from '@/lib/supabase';
import { Icon } from '@/components/ui/Icon';
import { NotificationCenter } from '@/components/shared/NotificationCenter';

// ── Icon primitives ─────────────────────────────────────────────────────────
// TI renders icons via the self-hosted @tabler/icons-react package (no CDN,
// no CSP exceptions needed — see components/ui/Icon.jsx for why this matters).
function TI({ icon, className = '' }) {
  return <Icon name={icon} className={className} />;
}

// ── AppShell ────────────────────────────────────────────────────────────────
export function AppShell({ children, navItems = [], title = '' }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { profile } = useAuth();

  const initials = profile
    ? `${profile.first_name?.[0] ?? ''}${profile.last_name?.[0] ?? ''}`.toUpperCase()
    : 'U';

  return (
    <div className="flex min-h-dvh bg-[var(--c-surface-0)]">

      {/* ── Sidebar (desktop) ── */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex flex-col',
          'w-[var(--sidebar-w)] bg-[var(--c-surface-1)] border-r border-[var(--c-line-1)]',
          'transition-transform duration-250 ease-out-soft',
          'lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 h-[var(--topbar-h)] border-b border-[var(--c-line-1)] shrink-0">
          <div
            className="w-8 h-8 rounded-[6px] flex items-center justify-center text-[12px] font-bold tracking-wide shrink-0"
            style={{ background: 'var(--product-accent)', color: '#1a1305' }}
          >
            TTA
          </div>
          <div className="font-heading font-bold text-[15px] text-[var(--c-ink-0)] tracking-tight leading-tight">
            Train To Teach<br />
            <span className="text-[var(--c-gold-400)] italic font-normal text-[13px]">Africa</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-3">
          <div className="space-y-0.5">
            {navItems.map((item) => (
              <SidebarItem key={item.to} item={item} onClick={() => setSidebarOpen(false)} />
            ))}
          </div>
        </nav>

        {/* User footer */}
        <div className="shrink-0 border-t border-[var(--c-line-1)] p-3">
          <UserFooter initials={initials} profile={profile} />
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Right side (topbar + main) ── */}
      <div className="flex flex-col flex-1 lg:ml-[var(--sidebar-w)]">

        {/* Topbar */}
        <header
          className="sticky top-0 z-20 flex items-center gap-3 px-4 lg:px-6 h-[var(--topbar-h)] bg-[var(--c-surface-1)] border-b border-[var(--c-line-1)] shrink-0"
        >
          {/* Mobile menu toggle */}
          <button
            className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg text-[var(--c-ink-2)] hover:bg-[var(--c-surface-3)] transition-colors"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
          >
            <TI icon="menu-2" className="text-xl" />
          </button>

          {/* Page title (mobile) */}
          <div className="lg:hidden font-heading font-semibold text-[15px] text-[var(--c-ink-0)]">
            {title}
          </div>

          <div className="flex-1" />

          {/* Search */}
          <button className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--c-surface-3)] border border-[var(--c-line-2)] text-[13px] text-[var(--c-ink-3)] hover:border-[var(--c-line-3)] transition-colors min-w-[180px]">
            <TI icon="search" className="text-[14px]" />
            Search…
            <span className="ml-auto font-mono text-[10px] text-[var(--c-ink-4)] bg-[var(--c-surface-4)] px-1.5 py-0.5 rounded">⌘K</span>
          </button>

          {/* Notifications — real-time dropdown */}
          <NotificationCenter />
          {/* Calendar */}
          <TopbarIconBtn icon="calendar-event" />
          {/* Help */}
          <TopbarIconBtn icon="help-circle" />

          {/* Avatar */}
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 cursor-pointer select-none"
            style={{ background: 'var(--product-accent)', color: '#1a1305' }}
            title={profile ? `${profile.first_name} ${profile.last_name}` : 'Profile'}
          >
            {initials}
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto product-glow-bg">
          <div className="max-w-[1200px] mx-auto px-4 lg:px-8 py-6 lg:py-8">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <MobileBottomNav navItems={navItems} />
    </div>
  );
}

// ── Sidebar nav item ─────────────────────────────────────────────────────────
function SidebarItem({ item, onClick }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150',
          isActive
            ? 'nav-active-glow text-[var(--c-ink-0)]'
            : 'text-[var(--c-ink-2)] hover:bg-[var(--c-surface-3)] hover:text-[var(--c-ink-1)]',
        )
      }
    >
      {({ isActive }) => (
        <>
          {item.icon && (
            <TI
              icon={item.icon}
              className={cn(
                'text-[18px] shrink-0 transition-colors',
                isActive ? 'accent-text' : 'text-[var(--c-ink-3)] group-hover:text-[var(--c-ink-2)]',
              )}
            />
          )}
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge != null && (
            <span className="ml-auto shrink-0 min-w-[18px] h-[18px] px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center bg-[var(--c-rose-400)] text-white">
              {item.badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

// ── Topbar icon button ───────────────────────────────────────────────────────
function TopbarIconBtn({ icon, badge }) {
  return (
    <button
      className="relative w-9 h-9 rounded-lg flex items-center justify-center text-[var(--c-ink-2)] hover:bg-[var(--c-surface-3)] transition-colors"
      aria-label={icon}
    >
      <TI icon={icon} className="text-xl" />
      {badge && (
        <span className="absolute top-1.5 right-1.5 w-[7px] h-[7px] rounded-full bg-[var(--c-rose-400)] border-2 border-[var(--c-surface-1)]" />
      )}
    </button>
  );
}

// ── User footer ──────────────────────────────────────────────────────────────
function UserFooter({ initials, profile }) {
  const navigate = useNavigate();

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    navigate('/sign-in');
  }, [navigate]);

  return (
    <div className="flex items-center gap-3 px-1 py-1">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
        style={{ background: 'var(--product-accent)', color: '#1a1305' }}
      >
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-semibold text-[var(--c-ink-1)] truncate">
          {profile ? `${profile.first_name} ${profile.last_name}` : 'User'}
        </div>
        <div className="text-[10px] text-[var(--c-ink-4)] font-mono truncate capitalize">
          {profile?.role?.replace('_', ' ') ?? ''}
        </div>
      </div>
      <button
        onClick={handleSignOut}
        title="Sign out"
        className="w-7 h-7 flex items-center justify-center rounded text-[var(--c-ink-4)] hover:text-[var(--c-ink-2)] hover:bg-[var(--c-surface-3)] transition-colors"
      >
        <TI icon="logout" className="text-[15px]" />
      </button>
    </div>
  );
}

// ── Mobile bottom nav ────────────────────────────────────────────────────────
function MobileBottomNav({ navItems }) {
  const visible = navItems.slice(0, 5);
  return (
    <nav className="fixed bottom-0 inset-x-0 z-20 lg:hidden bg-[var(--c-surface-1)] border-t border-[var(--c-line-2)]">
      <div className="flex">
        {visible.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
                isActive ? 'accent-text' : 'text-[var(--c-ink-3)]',
              )
            }
          >
            {item.icon && <TI icon={item.icon} className="text-[20px]" />}
            <span className="truncate max-w-[56px]">{item.label}</span>
          </NavLink>
        ))}
      </div>
      {/* iPhone home indicator safe area */}
      <div className="h-safe-area-inset-bottom bg-[var(--c-surface-1)]" />
    </nav>
  );
}
