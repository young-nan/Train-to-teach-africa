/**
 * src/components/layout/AppShell.jsx
 *
 * The chrome that wraps every authenticated app surface. One file, four
 * dashboards — keeps the header/footer/sync-pill behaviour consistent.
 */

import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { SyncPill } from '@/components/ui/SyncPill';
import { Mark, Wordmark } from '@/components/brand';
import { cn } from '@/utils/cn';

export function AppShell({ navItems = [], children, title }) {
  const { profile, schoolName, signOut } = useAuth();
  const navigate = useNavigate();

  const onSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="min-h-dvh bg-surface-1 text-ink-1 flex">
      {/* Sidebar — desktop only; mobile gets a bottom tab bar (TODO) */}
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
        <nav className="p-s-4 flex flex-col gap-s-1 flex-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => cn(
                'px-s-4 py-s-3 rounded-r-2 text-[13.5px]',
                isActive
                  ? 'bg-surface-3 text-ink-0 border border-line-2'
                  : 'text-ink-2 hover:text-ink-0 hover:bg-surface-3/50 border border-transparent',
              )}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-s-4 border-t border-line-1">
          <button
            onClick={onSignOut}
            className="w-full text-left px-s-4 py-s-3 rounded-r-2 text-[13.5px] text-ink-3 hover:text-ink-0 hover:bg-surface-3/50"
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="border-b border-line-1 bg-surface-1/85 backdrop-blur-md sticky top-0 z-40">
          <div className="px-s-6 lg:px-s-9 h-[64px] flex items-center justify-between">
            <h1 className="font-display text-[20px] text-ink-0">{title}</h1>
            <div className="flex items-center gap-s-4">
              <SyncPill />
              <div className="hidden md:flex items-center gap-s-3">
                <div className="text-right leading-tight">
                  <div className="text-[13px] text-ink-1">{profile?.full_name}</div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">{profile?.role?.replace('_',' ')}</div>
                </div>
                <Avatar name={profile?.full_name} />
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 px-s-6 lg:px-s-9 py-s-7">{children}</main>
      </div>
    </div>
  );
}

function Avatar({ name = '' }) {
  const initials = name.split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('') || '?';
  return (
    <div className="w-[36px] h-[36px] rounded-full bg-gold-400/15 border border-gold-400/30 grid place-items-center font-mono text-[12px] text-gold-200">
      {initials}
    </div>
  );
}
