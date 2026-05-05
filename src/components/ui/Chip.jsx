/**
 * src/components/ui/Chip.jsx
 *
 * Status chip from the Design Documentation. Six variants — never invent a
 * seventh, ever. If you need one, propose it via design system review.
 */

import { cn } from '@/utils/cn';

const VARIANT = {
  default: 'bg-surface-3 text-ink-2 border-line-2',
  gold:    'bg-gold-400/10 text-gold-200 border-gold-400/25',
  teal:    'bg-teal-400/10 text-teal-400 border-teal-400/25',
  amber:   'bg-amber-400/10 text-amber-400 border-amber-400/30',
  red:     'bg-red-400/10  text-red-400  border-red-400/30',
  green:   'bg-green-400/10 text-green-400 border-green-400/30',
};

export function Chip({ variant = 'default', dot = false, children, className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-s-2 px-s-3 py-[5px] rounded-full',
        'font-mono text-[11px] tracking-[0.06em] border',
        VARIANT[variant],
        className,
      )}
    >
      {dot && <span className={cn('w-[6px] h-[6px] rounded-full', dotColor(variant))} aria-hidden="true" />}
      {children}
    </span>
  );
}

function dotColor(variant) {
  return {
    default: 'bg-ink-3',
    gold: 'bg-gold-400',
    teal: 'bg-teal-400',
    amber: 'bg-amber-400',
    red: 'bg-red-400',
    green: 'bg-green-400',
  }[variant];
}
