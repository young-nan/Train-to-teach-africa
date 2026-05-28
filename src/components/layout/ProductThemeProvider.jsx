/**
 * src/components/layout/ProductThemeProvider.jsx
 *
 * Provides --product-accent and --product-glow CSS custom properties to every
 * descendant component. This is how the six TTA product surfaces get their
 * subtle emotional differentiation without needing separate design systems.
 *
 * SURFACES
 * ─────────
 *   public   → blue   (the brand spine — marketing, public pages)
 *   sims     → teal   (school operations, precision, trust)
 *   parent   → rose   (warmth, engagement, home learning)
 *   student  → coral  (momentum, progress, achievement)
 *   tutor    → emerald (verified, professional, vetted)
 *   admin    → blue   (mirrors public — school admin is a management surface)
 *
 * USAGE
 * ─────
 * Wrap each top-level app module once, at the router level:
 *
 *   // In your route file:
 *   <ProductTheme surface="sims">
 *     <TeacherApp />
 *   </ProductTheme>
 *
 * CONSUMING --product-accent IN COMPONENTS
 * ─────────────────────────────────────────
 * Components that want to use the current surface accent can do so via
 * inline style or a CSS class that reads the var:
 *
 *   // Inline (most direct):
 *   <div style={{ borderColor: 'var(--product-accent)' }} />
 *
 *   // Tailwind arbitrary value:
 *   <div className="border-[var(--product-accent)]" />
 *
 * Most components don't need to do this — they use fixed token colours
 * (blue-400, teal-400, etc.) directly. The --product-accent var is only
 * for composites that should adapt to whichever surface they're rendered on
 * (e.g. a shared <SyncPill /> that glows the right colour).
 *
 * THE 8% BLUE RULE
 * ────────────────
 * The --product-glow value keeps each surface's ambient glow subtle. It
 * appears once per page as a radial gradient behind the main hero content
 * via the .product-glow-bg utility class in styles.css. Never use it as
 * a large background fill — blue earns its keep through scarcity.
 */

/** @type {Record<string, { accent: string; glow: string }>} */
const ACCENTS = {
  public:  { accent: 'var(--c-blue-400)',    glow: 'rgba(99,102,241,0.10)'   },
  sims:    { accent: 'var(--c-teal-400)',    glow: 'rgba(20,184,166,0.06)'   },
  parent:  { accent: 'var(--c-rose-400)',    glow: 'rgba(236,72,153,0.08)'   },
  student: { accent: 'var(--c-coral-400)',   glow: 'rgba(244,63,94,0.08)'    },
  tutor:   { accent: 'var(--c-emerald-400)', glow: 'rgba(16,185,137,0.10)'   },
  admin:   { accent: 'var(--c-blue-400)',    glow: 'rgba(99,102,241,0.08)'   },
};

/**
 * @param {{ surface: keyof typeof ACCENTS; children: React.ReactNode }} props
 */
export function ProductTheme({ surface = 'public', children }) {
  const t = ACCENTS[surface] ?? ACCENTS.public;
  return (
    <div
      style={{
        '--product-accent': t.accent,
        '--product-glow':   t.glow,
      }}
    >
      {children}
    </div>
  );
}
