/**
 * src/components/brand/Wordmark.jsx
 *
 * "Train To Teach Africa" set in Crimson Text — the editorial display face
 * from the design system. "Africa" is italicised and gold; the primary
 * three-word phrase stays roman + ink-1 colour.
 *
 * Three sizes — pick by context:
 *   - 'sm' (16px) — header navs, dense surfaces
 *   - 'md' (22px) — auth panels, marketing footers
 *   - 'lg' (32px) — hero panels, marketing pages
 *
 * Compose with <Mark /> to get a full lockup; this component is text-only.
 * Keeping them separate means the mark can appear without the wordmark
 * (favicon, app sidebar collapsed state) and the wordmark can appear
 * without the mark (text-heavy contexts where another logo would be noise).
 */

import { cn } from '@/utils/cn';

const SIZE = {
  sm: 'text-[16px] leading-[1.05]',
  md: 'text-[22px] leading-[1.05]',
  lg: 'text-[32px] leading-[1.0] tracking-[-0.005em]',
};

export function Wordmark({ size = 'md', className, ...rest }) {
  return (
    <span
      className={cn(
        'inline-flex flex-wrap items-baseline gap-x-[0.25em] font-display text-ink-0 whitespace-nowrap',
        SIZE[size],
        className,
      )}
      {...rest}
    >
      <span className="font-semibold">Train To Teach</span>
      <span className="italic font-normal text-gold-200">Africa</span>
    </span>
  );
}

/**
 * Convenience: mark + wordmark in horizontal lockup.
 * The most common pattern across the platform — used in PublicNav and AppShell.
 */
import { Mark } from './Mark';

export function Logo({
  size = 'md',
  variant = 'gold',
  surfaceColor,
  className,
  ...rest
}) {
  const markSize = { sm: 24, md: 32, lg: 44 }[size] ?? 32;
  return (
    <span className={cn('inline-flex items-center gap-[0.5em]', className)} {...rest}>
      <Mark size={markSize} variant={variant} surfaceColor={surfaceColor} />
      <Wordmark size={size} />
    </span>
  );
}
