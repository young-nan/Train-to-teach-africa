/**
 * src/components/ui/PilotBanner.jsx
 *
 * The pilot mode banner. Renders at the very top of every authenticated
 * surface (inside AppShell, above the sticky header) when pilot mode is on.
 *
 * SuperAdmin sees it with a live toggle.
 * All other roles see it as a read-only info strip.
 *
 * Design: gold text on a near-black background, 40px tall, full-width.
 * Matches the "8% gold rule" from the design system — gold earns its keep
 * through scarcity, not saturation.
 */

import { usePilotMode } from '@/hooks/usePilotMode';
import { PILOT_BANNER_TEXT } from '@/config/pilotMode';
import { cn } from '@/utils/cn';

export function PilotBanner() {
  const { pilotMode, togglePilotMode, canToggle } = usePilotMode();

  if (!pilotMode) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'w-full flex items-center justify-between gap-s-4',
        'px-s-5 lg:px-s-9',
        'bg-surface-0 border-b border-gold-400/20',
        'h-[40px] text-[11px] font-mono tracking-[0.08em]',
      )}
    >
      {/* Left: status dot + message */}
      <div className="flex items-center gap-s-3">
        <span className="w-[7px] h-[7px] rounded-full bg-gold-400 animate-pulse shrink-0" aria-hidden="true" />
        <span className="text-gold-200">{PILOT_BANNER_TEXT}</span>
      </div>

      {/* Right: toggle (super_admin only) */}
      {canToggle && (
        <label className="flex items-center gap-s-3 cursor-pointer select-none">
          <span className="text-ink-3 text-[11px]">Pilot mode</span>
          <button
            type="button"
            role="switch"
            aria-checked={pilotMode}
            onClick={() => togglePilotMode(!pilotMode)}
            className={cn(
              'relative inline-flex w-[36px] h-[20px] rounded-full transition-colors duration-200',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-400 focus-visible:outline-offset-2',
              pilotMode ? 'bg-gold-400' : 'bg-surface-4',
            )}
          >
            <span
              className={cn(
                'absolute top-[2px] w-[16px] h-[16px] rounded-full bg-surface-0 transition-all duration-200',
                pilotMode ? 'left-[18px]' : 'left-[2px]',
              )}
            />
          </button>
        </label>
      )}
    </div>
  );
}
