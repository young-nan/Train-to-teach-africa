/**
 * src/components/ui/Card.jsx
 *
 * Two card primitives:
 *   - Card:   the generic surface (most uses)
 *   - KpiCard: the dashboard KPI tile (label + giant numeral + trend)
 *
 * Anything more specialised (LessonCard, GiantAction) lives in its own file.
 */

import { cn } from '@/utils/cn';

export function Card({ as: Comp = 'div', className, children, ...rest }) {
  return (
    <Comp
      className={cn(
        'bg-surface-2 border border-line-1 rounded-r-3 p-s-6',
        className,
      )}
      {...rest}
    >
      {children}
    </Comp>
  );
}

export function KpiCard({ label, value, trend, trendIntent = 'green', className }) {
  return (
    <div
      className={cn(
        'bg-surface-3 border border-line-1 rounded-r-3 p-s-5',
        'flex flex-col gap-s-2',
        className,
      )}
    >
      <div className="font-mono text-meta uppercase text-ink-3">{label}</div>
      <div className="font-display text-[28px] leading-none tracking-[-0.015em] text-ink-0">
        {value}
      </div>
      {trend && (
        <div className={cn(
          'font-mono text-[11px]',
          trendIntent === 'green' && 'text-green-400',
          trendIntent === 'red' && 'text-red-400',
          trendIntent === 'amber' && 'text-amber-400',
          trendIntent === 'neutral' && 'text-ink-3',
        )}>
          {trend}
        </div>
      )}
    </div>
  );
}
