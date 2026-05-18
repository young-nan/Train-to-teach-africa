/**
 * src/components/ui/Card.jsx
 *
 * Two card primitives, both backward-compatible:
 *
 *   Card     — the generic surface container (most uses)
 *   KpiCard  — dashboard KPI tile (design system §05 · Components)
 *
 * KpiCard v2 changes (all new props are optional — existing callsites unchanged):
 *   - `delta`      string  — e.g. "↑ 18 this term" or "↓ 4 vs avg"
 *   - `deltaDir`   'up' | 'down' | 'flat' — drives arrow colour
 *   - `footnote`   string  — small grey line below delta (context / timestamp)
 *   - `isLoading`  bool    — shows a skeleton shimmer instead of content
 *   - `trendIntent` still works as before (maps to deltaDir internally)
 *
 * The `trend` prop (legacy) still renders when `delta` is absent — so every
 * existing KpiCard call keeps working without changes.
 *
 * Anything more specialised (QuickActionCard, UpNextCard) lives in its own file.
 */

import { cn } from '@/utils/cn';

// ── Card ──────────────────────────────────────────────────────────────────────

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

// ── KpiCard ───────────────────────────────────────────────────────────────────

/**
 * @param {object} props
 * @param {string}  props.label       — eyebrow label (e.g. "Attendance · today")
 * @param {string}  props.value       — the big number/string (e.g. "94%")
 * @param {string}  [props.delta]     — v2: trend line with direction arrow
 * @param {'up'|'down'|'flat'} [props.deltaDir] — v2: arrow colour
 * @param {string}  [props.footnote]  — v2: small context line below delta
 * @param {string}  [props.trend]     — legacy: plain trend string (no arrow)
 * @param {'green'|'red'|'amber'|'neutral'|'positive'|'negative'|'warning'}
 *                  [props.trendIntent] — legacy: colour driver for trend
 * @param {boolean} [props.isLoading] — shows shimmer skeleton
 * @param {string}  [props.className]
 */
export function KpiCard({
  label,
  value,
  delta,
  deltaDir,
  footnote,
  trend,
  trendIntent = 'neutral',
  isLoading = false,
  className,
}) {
  // Loading skeleton
  if (isLoading) {
    return (
      <div className={cn(
        'bg-surface-3 border border-line-1 rounded-r-3 p-s-5 flex flex-col gap-s-3',
        className,
      )}>
        <div className="h-[11px] w-[60%] rounded bg-surface-4 animate-pulse" />
        <div className="h-[32px] w-[75%] rounded bg-surface-4 animate-pulse" />
        <div className="h-[11px] w-[50%] rounded bg-surface-4 animate-pulse" />
      </div>
    );
  }

  // Derive deltaDir from trendIntent when not explicit
  const resolvedDir = deltaDir
    ?? (trendIntent === 'green' || trendIntent === 'positive' ? 'up'
      : trendIntent === 'red'   || trendIntent === 'negative' ? 'down'
      : trendIntent === 'amber' || trendIntent === 'warning'  ? 'flat'
      : 'flat');

  const deltaColour = {
    up:   'text-green-400',
    down: 'text-red-400',
    flat: 'text-amber-400',
  }[resolvedDir] ?? 'text-ink-3';

  // Legacy trendIntent colour (used when `delta` is absent and `trend` is present)
  const legacyTrendColour = {
    green:    'text-green-400',
    positive: 'text-green-400',
    red:      'text-red-400',
    negative: 'text-red-400',
    amber:    'text-amber-400',
    warning:  'text-amber-400',
    neutral:  'text-ink-3',
  }[trendIntent] ?? 'text-ink-3';

  return (
    <div className={cn(
      'bg-surface-3 border border-line-1 rounded-r-3 p-s-5 flex flex-col',
      className,
    )}>
      {/* Eyebrow label */}
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-3 leading-none">
        {label}
      </div>

      {/* Big value */}
      <div className="mt-s-3 font-display text-[36px] leading-none tracking-[-0.02em] text-ink-0">
        {value}
      </div>

      {/* Delta (v2) — direction arrow + text */}
      {delta && (
        <div className={cn('mt-s-4 flex items-center gap-[5px] font-mono text-[11px] tracking-[0.04em]', deltaColour)}>
          {resolvedDir === 'up'   && <Arrow dir="up" />}
          {resolvedDir === 'down' && <Arrow dir="down" />}
          {resolvedDir === 'flat' && <Arrow dir="flat" />}
          <span>{delta}</span>
        </div>
      )}

      {/* Trend (legacy — no arrow, just coloured text) */}
      {!delta && trend && (
        <div className={cn('mt-s-3 font-mono text-[11px] tracking-[0.04em]', legacyTrendColour)}>
          {trend}
        </div>
      )}

      {/* Footnote — small grey context line */}
      {footnote && (
        <div className="mt-s-3 pt-s-3 border-t border-line-1 font-mono text-[11px] text-ink-3 leading-snug">
          {footnote}
        </div>
      )}
    </div>
  );
}

// Tiny inline arrow SVG — keeps the icon zero-dep
function Arrow({ dir }) {
  if (dir === 'up') return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d="M5 8V2M2 5l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  if (dir === 'down') return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d="M5 2v6M2 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d="M2 5h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
