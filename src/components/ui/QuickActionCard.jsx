/**
 * src/components/ui/QuickActionCard.jsx
 *
 * Dashboard quick-action tile. Used on the teacher and admin dashboards.
 *
 * VARIANTS
 * ─────────
 *   primary  — gold gradient background + filled gold icon dot
 *              Used for the single most-urgent action on the screen.
 *              Design rule: max ONE primary tile per view.
 *
 *   default  — flat dark surface + ghost icon dot
 *              Used for secondary actions.
 *
 * PROPS
 * ─────
 *   label       string    — action title (e.g. "Mark attendance")
 *   meta        string    — supporting line (e.g. "8 classes · not yet started")
 *   icon        ReactNode — any icon element (usually an inline SVG from AppShell icons)
 *   variant     'primary' | 'default'  (default: 'default')
 *   urgent      bool      — shows a small "Action needed" eyebrow badge
 *   disabled    bool      — dims and removes pointer events
 *   onClick     function
 *   to          string    — if provided, renders as a <Link> instead of <button>
 *   className   string
 *
 * DESIGN NOTES
 * ─────────────
 * The icon sits in a 36×36 dot. Primary variant fills it gold; default fills
 * it with surface-3. The tile itself is always square-ish (aspect ~1.1:1) to
 * form a grid of 4 on desktop, 2 on mobile — matching the design system mock.
 *
 * "8% gold rule" — the gold gradient in the primary variant is only 12% opacity
 * at its peak. It reads as warm emphasis, not a solid gold block.
 */

import { Link } from 'react-router-dom';
import { cn } from '@/utils/cn';

export function QuickActionCard({
  label,
  meta,
  icon,
  variant = 'default',
  urgent = false,
  disabled = false,
  onClick,
  to,
  className,
}) {
  const isPrimary = variant === 'primary';

  const inner = (
    <>
      {/* Icon dot */}
      <div className={cn(
        'w-[36px] h-[36px] rounded-r-2 grid place-items-center mb-s-4 shrink-0',
        isPrimary
          ? 'bg-gold-400 text-[#1a1305]'
          : 'bg-surface-4 text-ink-2',
      )}>
        {icon}
      </div>

      {/* Urgent badge */}
      {urgent && !isPrimary && (
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-gold-400 mb-s-1">
          Action needed
        </div>
      )}

      {/* Label */}
      <div className={cn(
        'text-[14px] font-semibold font-heading leading-tight',
        isPrimary ? 'text-ink-0' : 'text-ink-1',
      )}>
        {label}
      </div>

      {/* Meta */}
      {meta && (
        <div className={cn(
          'mt-s-2 font-mono text-[11px] tracking-[0.04em] leading-snug',
          isPrimary ? 'text-gold-200' : 'text-ink-3',
        )}>
          {meta}
        </div>
      )}
    </>
  );

  const baseClass = cn(
    'flex flex-col p-s-5 rounded-r-3 border transition-all duration-150 text-left',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-400 focus-visible:outline-offset-2',
    isPrimary
      ? 'border-gold-400/30 hover:border-gold-400/60'
      : 'border-line-1 hover:border-line-3 hover:bg-surface-3/60',
    disabled && 'opacity-40 pointer-events-none',
    className,
  );

  const style = isPrimary
    ? { background: 'linear-gradient(135deg, rgba(229,166,42,.12), rgba(229,166,42,.02))' }
    : {};

  if (to) {
    return (
      <Link to={to} className={cn(baseClass, 'bg-surface-2')} style={style}>
        {inner}
      </Link>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(baseClass, 'bg-surface-2')}
      style={style}
    >
      {inner}
    </button>
  );
}

/**
 * QuickActionGrid — convenience wrapper that renders 4 QuickActionCards in the
 * correct 4-col / 2-col responsive grid. Optional; callers can build their
 * own grid if they need different column counts.
 *
 * Usage:
 *   <QuickActionGrid>
 *     <QuickActionCard variant="primary" label="Mark attendance" ... />
 *     <QuickActionCard label="Enter scores" ... />
 *   </QuickActionGrid>
 */
export function QuickActionGrid({ children, className }) {
  return (
    <div className={cn('grid grid-cols-2 lg:grid-cols-4 gap-s-3', className)}>
      {children}
    </div>
  );
}
