/**
 * src/components/ui/Button.jsx
 *
 * The single Button component. Three intents:
 *   - primary: gold, used for the page's main CTA (one per surface)
 *   - ghost:   outline, used for secondary actions
 *   - text:    no chrome, used for tertiary links
 *
 * Mirrors the Design Documentation § Components · Buttons.
 * Focus ring, disabled state, loading state are all built-in — components
 * never have to redo this work.
 */

import { forwardRef } from 'react';
import { cn } from '@/utils/cn';

const INTENT = {
  primary:
    'bg-gold-400 text-[#1a1305] shadow-gold hover:bg-gold-200 hover:-translate-y-px ' +
    'active:translate-y-px active:shadow-none ' +
    'disabled:bg-surface-4 disabled:text-ink-4 disabled:shadow-none disabled:cursor-not-allowed disabled:hover:translate-y-0',
  ghost:
    'bg-transparent text-ink-1 border border-line-3 hover:bg-surface-3 ' +
    'disabled:text-ink-4 disabled:border-line-1 disabled:cursor-not-allowed disabled:hover:bg-transparent',
  text:
    'bg-transparent text-gold-200 hover:text-gold-50 px-s-3 ' +
    'disabled:text-ink-4 disabled:cursor-not-allowed',
};

const SIZE = {
  sm: 'text-[13px] px-s-4 py-s-2',
  md: 'text-[14px] px-s-5 py-s-3',
  lg: 'text-[15px] px-s-6 py-s-4',
};

export const Button = forwardRef(function Button(
  {
    intent = 'primary',
    size = 'md',
    isLoading = false,
    leadingIcon,
    trailingIcon,
    className,
    children,
    disabled,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      className={cn(
        'inline-flex items-center gap-s-3 rounded-r-2 font-medium font-sans',
        'transition-all duration-150 ease-out-soft',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400',
        INTENT[intent],
        SIZE[size],
        className,
      )}
      {...rest}
    >
      {isLoading ? <Spinner /> : leadingIcon}
      <span>{children}</span>
      {!isLoading && trailingIcon}
    </button>
  );
});

function Spinner() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
