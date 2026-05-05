/**
 * src/components/brand/Mark.jsx
 *
 * THE Train To Teach Africa mark — the Compass-Sun.
 *
 * Anatomy:
 *   - Five upper rays (N, NE, NW, E, W) — the dominant rising-sun gesture.
 *     Cardinals are heavy strokes (3.5px); ordinals are lighter (3.5px each
 *     but at narrower angles, so they read as secondary).
 *   - Two faint lower rays (SE, SW) at 40% opacity — they hint at compass
 *     completeness without competing with the rising sun.
 *   - Half-circle horizon below the rays — grounds the mark, doubles as a
 *     stylised letter form.
 *   - "TT" lockup inside the horizon — the wordmark monogram, rendered as
 *     three strokes (one horizontal crossbar, two vertical stems).
 *   - Centre dot at origin — visual anchor.
 *
 * Why a parametrised component instead of an inline SVG everywhere:
 *   The mark appears in the favicon, the nav, the app sidebar, the auth
 *   panel, the email template, the WhatsApp profile, and eventually print
 *   collateral. Inlining it in each place means seven places to update
 *   when the mark evolves. One component = one update.
 *
 * Variants:
 *   - 'gold'    — gold strokes on transparent bg (default; for dark surfaces)
 *   - 'dark'    — dark navy strokes on transparent bg (for light surfaces)
 *   - 'mono'    — single-colour, inherits currentColor (for print/embroidery)
 *   - 'inverse' — gold strokes on a dark navy filled square (favicon style)
 */

const VARIANT_COLORS = {
  // `surface` is the colour the TT monogram is "punched out" in — it must
  // match the actual background you're rendering the mark on, otherwise
  // the monogram will not knock out cleanly. Defaults below cover the
  // 90% case (gold mark on dark surface, dark mark on light surface).
  gold:    { stroke: '#e5a62a',     surface: '#0d0f1a', faint: 0.4 },
  dark:    { stroke: '#0d0f1a',     surface: '#ffffff', faint: 0.35 },
  mono:    { stroke: 'currentColor', surface: 'transparent', faint: 0.35 },
  inverse: { stroke: '#e5a62a',     surface: '#0d0f1a', faint: 0.4 },
};

export function Mark({
  size = 32,
  variant = 'gold',
  // When `inverse`, the mark sits inside a rounded square (favicon-style
  // chrome). For all other variants the chrome is suppressed.
  chrome = null,
  // Override the monogram knock-out colour. Pass this when rendering on
  // a non-default surface (e.g. the auth panel uses `#13162a`, not `#0d0f1a`).
  surfaceColor,
  className,
  ...rest
}) {
  const c = VARIANT_COLORS[variant] ?? VARIANT_COLORS.gold;
  const showChrome = chrome ?? variant === 'inverse';
  const knockout = surfaceColor ?? c.surface;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Train To Teach Africa"
      className={className}
      {...rest}
    >
      {showChrome && (
        <rect x="2" y="2" width="96" height="96" rx="20" fill={knockout} />
      )}

      {/* Upper rays — cardinals + ordinals */}
      <g transform="translate(50, 50)">
        <line x1="0"   y1="-32" x2="0"   y2="-18" stroke={c.stroke} strokeWidth="4" strokeLinecap="round" />
        <line x1="23"  y1="-23" x2="13"  y2="-13" stroke={c.stroke} strokeWidth="4" strokeLinecap="round" />
        <line x1="-23" y1="-23" x2="-13" y2="-13" stroke={c.stroke} strokeWidth="4" strokeLinecap="round" />
        <line x1="32"  y1="0"   x2="18"  y2="0"   stroke={c.stroke} strokeWidth="4" strokeLinecap="round" />
        <line x1="-32" y1="0"   x2="-18" y2="0"   stroke={c.stroke} strokeWidth="4" strokeLinecap="round" />

        {/* Lower-quadrant secondary rays (compass hint) */}
        <line x1="17"  y1="17"  x2="10"  y2="10"  stroke={c.stroke} strokeWidth="3" strokeLinecap="round" opacity={c.faint} />
        <line x1="-17" y1="17"  x2="-10" y2="10"  stroke={c.stroke} strokeWidth="3" strokeLinecap="round" opacity={c.faint} />

        {/* Horizon — half-circle grounded by a horizontal line */}
        <path d="M -22 0 A 22 22 0 0 0 22 0 Z" stroke={c.stroke} strokeWidth="3.5" strokeLinejoin="round" />
        <line x1="-22" y1="0" x2="22" y2="0" stroke={c.stroke} strokeWidth="3.5" strokeLinecap="round" />

        {/* TT monogram inside the horizon — knocked out in the surface colour */}
        <line x1="-11"  y1="-5.5" x2="11"   y2="-5.5" stroke={knockout} strokeWidth="3.5" strokeLinecap="round" />
        <line x1="-5.5" y1="-5.5" x2="-5.5" y2="7"    stroke={knockout} strokeWidth="3.5" strokeLinecap="round" />
        <line x1="5.5"  y1="-5.5" x2="5.5"  y2="7"    stroke={knockout} strokeWidth="3.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}
