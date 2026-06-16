/**
 * TTA UI Component Library v3
 * All primitive components used across every role module.
 */

import { cn } from '@/utils/cn';

// ── Card ─────────────────────────────────────────────────────────────────────
export function Card({ children, className, padding = true }) {
  return (
    <div
      className={cn(
        'bg-[var(--c-surface-2)] border border-[var(--c-line-2)] rounded-xl',
        padding && 'p-5',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, action, children }) {
  return (
    <div className="flex items-center justify-between mb-4">
      {title && (
        <h3 className="font-heading font-semibold text-[14px] text-[var(--c-ink-1)]">{title}</h3>
      )}
      {action && (
        <button className="text-[12px] font-medium text-[var(--product-accent)] hover:opacity-80 transition-opacity">
          {action}
        </button>
      )}
      {children}
    </div>
  );
}

// ── KPI Card ─────────────────────────────────────────────────────────────────
export function KpiCard({ label, value, delta, deltaDir = 'flat', footnote, isLoading, icon }) {
  const deltaColors = {
    up:   'text-[var(--c-green-400)]',
    down: 'text-[var(--c-rose-400)]',
    flat: 'text-[var(--c-ink-3)]',
  };
  const arrows = { up: '↑', down: '↓', flat: '→' };

  return (
    <div className="bg-[var(--c-surface-2)] border border-[var(--c-line-2)] rounded-xl p-5 relative overflow-hidden">
      {icon && (
        <div className="absolute top-4 right-4 w-9 h-9 rounded-lg flex items-center justify-center opacity-30"
          style={{ background: 'var(--product-accent)' }}>
          <i className={`ti ti-${icon} text-[18px]`} style={{ color: '#1a1305' }} aria-hidden="true" />
        </div>
      )}
      <div className="text-[11px] font-mono uppercase tracking-[0.1em] text-[var(--c-ink-3)] mb-2">{label}</div>
      {isLoading
        ? <div className="h-8 w-16 rounded bg-[var(--c-surface-4)] animate-pulse mb-1" />
        : <div className="font-heading text-[28px] font-bold text-[var(--c-ink-0)] leading-none tabular-nums">{value}</div>
      }
      {delta && (
        <div className={cn('text-[11px] mt-1.5 flex items-center gap-1', deltaColors[deltaDir])}>
          <span>{arrows[deltaDir]}</span>
          <span>{delta}</span>
        </div>
      )}
      {footnote && !delta && (
        <div className="text-[11px] text-[var(--c-ink-4)] mt-1.5 font-mono">{footnote}</div>
      )}
      <div className="absolute bottom-0 left-0 right-0 h-[3px] opacity-40 rounded-b-xl"
        style={{ background: 'var(--product-accent)' }} />
    </div>
  );
}

// ── Chip / Badge ─────────────────────────────────────────────────────────────
const CHIP_VARIANTS = {
  default: 'bg-[var(--c-surface-4)] text-[var(--c-ink-2)]',
  green:   'bg-[rgba(63,185,80,0.15)] text-[var(--c-green-400)]',
  red:     'bg-[rgba(239,83,80,0.15)] text-[var(--c-red-400)]',
  amber:   'bg-[rgba(245,165,36,0.15)] text-[var(--c-amber-400)]',
  gold:    'bg-[rgba(229,166,42,0.15)] text-[var(--c-gold-400)]',
  teal:    'bg-[rgba(34,184,166,0.15)] text-[var(--c-teal-400)]',
  rose:    'bg-[rgba(251,113,133,0.15)] text-[var(--c-rose-400)]',
  coral:   'bg-[rgba(249,112,102,0.15)] text-[var(--c-coral-400)]',
  emerald: 'bg-[rgba(16,185,129,0.15)] text-[var(--c-emerald-400)]',
  violet:  'bg-[rgba(124,58,237,0.15)] text-[#a78bfa]',
  sky:     'bg-[rgba(59,130,246,0.15)] text-[var(--c-sky-400)]',
};

export function Chip({ children, variant = 'default', size = 'md', dot }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-semibold',
        size === 'sm' ? 'px-2 py-[2px] text-[10px]' : 'px-2.5 py-[3px] text-[11px]',
        CHIP_VARIANTS[variant] ?? CHIP_VARIANTS.default,
      )}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />}
      {children}
    </span>
  );
}

// ── Button ────────────────────────────────────────────────────────────────────
const BTN_VARIANTS = {
  primary: 'text-[#1a1305] hover:opacity-90',
  ghost:   'bg-[var(--c-surface-3)] text-[var(--c-ink-1)] border border-[var(--c-line-2)] hover:bg-[var(--c-surface-4)]',
  danger:  'bg-[rgba(239,83,80,0.15)] text-[var(--c-red-400)] border border-[rgba(239,83,80,0.2)] hover:bg-[rgba(239,83,80,0.25)]',
  link:    'text-[var(--product-accent)] hover:opacity-80 p-0',
};

export function Button({ children, variant = 'ghost', size = 'md', onClick, disabled, isLoading, className, icon, to, type = 'button' }) {
  const base = cn(
    'inline-flex items-center gap-2 rounded-lg font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed',
    size === 'sm' ? 'px-3 py-1.5 text-[12px]' : size === 'lg' ? 'px-5 py-3 text-[14px]' : 'px-4 py-2 text-[13px]',
    variant === 'primary' ? 'text-[#1a1305] hover:opacity-90' : '',
    BTN_VARIANTS[variant] ?? BTN_VARIANTS.ghost,
    className,
  );

  const content = (
    <>
      {isLoading
        ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        : icon && <i className={`ti ti-${icon} text-[16px]`} aria-hidden="true" />
      }
      {children}
    </>
  );

  if (variant === 'primary') {
    return (
      <button
        type={type}
        className={base}
        style={{ background: 'var(--product-accent)' }}
        onClick={onClick}
        disabled={disabled || isLoading}
      >
        {content}
      </button>
    );
  }

  return (
    <button
      type={type}
      className={base}
      onClick={onClick}
      disabled={disabled || isLoading}
    >
      {content}
    </button>
  );
}

// ── Page Header ───────────────────────────────────────────────────────────────
export function PageHeader({ eyebrow, title, subtitle, children }) {
  return (
    <div className="mb-6">
      {eyebrow && (
        <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--product-accent)] mb-1.5">
          {eyebrow}
        </div>
      )}
      <h1 className="font-heading text-[22px] font-bold text-[var(--c-ink-0)] tracking-tight leading-tight">
        {title}
      </h1>
      {subtitle && (
        <p className="text-[13px] text-[var(--c-ink-3)] mt-1">{subtitle}</p>
      )}
      {children && (
        <div className="flex items-center gap-2 mt-4 flex-wrap">{children}</div>
      )}
    </div>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────
export function SectionLabel({ children }) {
  return (
    <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--c-ink-4)] px-1 mb-1 mt-3 first:mt-0">
      {children}
    </div>
  );
}

// ── Data table ────────────────────────────────────────────────────────────────
export function DataTable({ columns, rows, emptyMessage = 'No data yet.' }) {
  if (!rows?.length) {
    return <Empty message={emptyMessage} />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr className="border-b border-[var(--c-line-2)]">
            {columns.map((col) => (
              <th
                key={col.key}
                className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--c-ink-3)] pb-3 pr-4 font-semibold"
                style={{ width: col.width }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={row.id ?? ri}
              className="border-b border-[var(--c-line-1)] last:border-0 hover:bg-[var(--c-surface-3)] transition-colors"
            >
              {columns.map((col) => (
                <td key={col.key} className="py-3 pr-4 text-[var(--c-ink-1)] align-middle">
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────
export function ProgressBar({ value, max = 100, color, className }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className={cn('h-1.5 bg-[var(--c-surface-4)] rounded-full overflow-hidden', className)}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: color ?? 'var(--product-accent)' }}
      />
    </div>
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────────
export function Spinner({ size = 'md' }) {
  const sz = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-8 h-8' : 'w-5 h-5';
  return (
    <div className={cn('border-2 border-[var(--c-line-3)] border-t-[var(--product-accent)] rounded-full animate-spin', sz)} />
  );
}

export function LoadingScreen() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[300px]">
      <Spinner size="lg" />
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
export function Empty({ message, icon = 'inbox', action }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
      <div className="w-12 h-12 rounded-full bg-[var(--c-surface-3)] flex items-center justify-center">
        <i className={`ti ti-${icon} text-[24px] text-[var(--c-ink-4)]`} aria-hidden="true" />
      </div>
      <p className="text-[13px] text-[var(--c-ink-3)] max-w-[260px]">{message}</p>
      {action}
    </div>
  );
}

// ── Alert / notice box ────────────────────────────────────────────────────────
export function Alert({ type = 'info', children }) {
  const styles = {
    info:    { border: 'var(--c-teal-400)', bg: 'rgba(34,184,166,0.08)', icon: 'info-circle', color: 'var(--c-teal-400)' },
    warning: { border: 'var(--c-amber-400)', bg: 'rgba(245,165,36,0.08)', icon: 'alert-triangle', color: 'var(--c-amber-400)' },
    error:   { border: 'var(--c-red-400)', bg: 'rgba(239,83,80,0.08)', icon: 'alert-circle', color: 'var(--c-red-400)' },
    success: { border: 'var(--c-green-400)', bg: 'rgba(63,185,80,0.08)', icon: 'circle-check', color: 'var(--c-green-400)' },
  };
  const s = styles[type];
  return (
    <div
      className="flex gap-3 p-4 rounded-xl border"
      style={{ borderColor: s.border, background: s.bg }}
    >
      <i className={`ti ti-${s.icon} text-[18px] mt-0.5 shrink-0`} style={{ color: s.color }} aria-hidden="true" />
      <div className="text-[13px] text-[var(--c-ink-1)]">{children}</div>
    </div>
  );
}

// ── Form primitives ───────────────────────────────────────────────────────────
export function FormGroup({ label, children, hint, error }) {
  return (
    <div className="mb-4">
      {label && (
        <label className="block text-[12px] font-medium text-[var(--c-ink-2)] mb-1.5">{label}</label>
      )}
      {children}
      {hint && !error && <p className="mt-1 text-[11px] text-[var(--c-ink-4)]">{hint}</p>}
      {error && <p className="mt-1 text-[11px] text-[var(--c-red-400)]">{error}</p>}
    </div>
  );
}

export function Input({ className, ...props }) {
  return (
    <input
      className={cn(
        'w-full bg-[var(--c-surface-3)] border border-[var(--c-line-2)] rounded-lg px-3 py-2.5',
        'text-[13px] text-[var(--c-ink-1)] placeholder:text-[var(--c-ink-4)]',
        'outline-none focus:border-[var(--product-accent)] transition-colors',
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }) {
  return (
    <select
      className={cn(
        'w-full bg-[var(--c-surface-3)] border border-[var(--c-line-2)] rounded-lg px-3 py-2.5',
        'text-[13px] text-[var(--c-ink-1)]',
        'outline-none focus:border-[var(--product-accent)] transition-colors appearance-none',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }) {
  return (
    <textarea
      className={cn(
        'w-full bg-[var(--c-surface-3)] border border-[var(--c-line-2)] rounded-lg px-3 py-2.5',
        'text-[13px] text-[var(--c-ink-1)] placeholder:text-[var(--c-ink-4)]',
        'outline-none focus:border-[var(--product-accent)] transition-colors resize-y',
        className,
      )}
      {...props}
    />
  );
}

// ── Avatar ────────────────────────────────────────────────────────────────────
export function Avatar({ name = '', size = 'md', color }) {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const sz = size === 'sm' ? 'w-7 h-7 text-[10px]' : size === 'lg' ? 'w-10 h-10 text-[14px]' : 'w-8 h-8 text-[11px]';
  return (
    <div
      className={cn('rounded-full flex items-center justify-center font-bold shrink-0', sz)}
      style={{ background: color ?? 'var(--product-accent)', color: '#1a1305' }}
    >
      {initials || '?'}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
export function Skeleton({ className }) {
  return <div className={cn('bg-[var(--c-surface-3)] animate-pulse rounded-lg', className)} />;
}

// ── Stat row (inside cards) ────────────────────────────────────────────────────
export function StatRow({ label, value, color }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[var(--c-line-1)] last:border-0">
      <span className="text-[13px] text-[var(--c-ink-2)]">{label}</span>
      <span className="font-semibold text-[13px]" style={{ color: color ?? 'var(--c-ink-0)' }}>{value}</span>
    </div>
  );
}

// ── List item row ─────────────────────────────────────────────────────────────
export function ListItem({ icon, iconBg, title, subtitle, meta, metaSub, onClick }) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 py-3 border-b border-[var(--c-line-1)] last:border-0',
        onClick && 'cursor-pointer hover:bg-[var(--c-surface-3)] -mx-3 px-3 rounded-lg transition-colors',
      )}
      onClick={onClick}
    >
      {icon && (
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-[16px]"
          style={{ background: iconBg ?? 'var(--c-surface-4)' }}
        >
          {typeof icon === 'string' ? <i className={`ti ti-${icon}`} aria-hidden="true" /> : icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-[var(--c-ink-1)] truncate">{title}</div>
        {subtitle && <div className="text-[11px] text-[var(--c-ink-3)] mt-0.5">{subtitle}</div>}
      </div>
      {(meta || metaSub) && (
        <div className="text-right shrink-0">
          {meta && <div className="text-[13px] font-semibold text-[var(--c-ink-0)]">{meta}</div>}
          {metaSub && <div className="text-[11px] text-[var(--c-ink-3)]">{metaSub}</div>}
        </div>
      )}
    </div>
  );
}

// ── Divider ───────────────────────────────────────────────────────────────────
export function Divider({ className }) {
  return <div className={cn('h-px bg-[var(--c-line-1)]', className)} />;
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex gap-0.5 border-b border-[var(--c-line-2)] mb-5 overflow-x-auto">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={cn(
            'px-4 py-2 text-[13px] font-medium whitespace-nowrap border-b-2 transition-all -mb-px',
            active === tab.key
              ? 'text-[var(--c-ink-0)] border-[var(--product-accent)]'
              : 'text-[var(--c-ink-3)] border-transparent hover:text-[var(--c-ink-1)]',
          )}
        >
          {tab.label}
          {tab.count != null && (
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] bg-[var(--c-surface-4)] text-[var(--c-ink-3)]">
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ── Inline segment control ────────────────────────────────────────────────────
export function SegmentControl({ options, value, onChange }) {
  return (
    <div className="flex bg-[var(--c-surface-3)] rounded-lg p-1 gap-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'flex-1 py-1.5 px-3 rounded-md text-[12px] font-semibold transition-all',
            value === opt.value
              ? 'bg-[var(--c-surface-5)] text-[var(--c-ink-0)]'
              : 'text-[var(--c-ink-3)] hover:text-[var(--c-ink-1)]',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
