/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      // ── Design System v2 tokens ──────────────────────────────────────────
      // Migrated per tta-design-system.html (May 2026).
      // All v1 tokens kept intact — new tokens added alongside.
      // Existing components keep working with no changes required.
      colors: {
        surface: {
          0: '#0f1729',
          1: '#131c2e',
          2: '#1a2536',
          3: '#212d3f',
          4: '#2a3a4f',
          5: '#344659',
        },
        ink: {
          0: '#ffffff',
          1: '#f0f4f8',
          2: '#cbd5e1',
          3: '#8b95a7',
          4: '#5a6577',
        },
        gold: {
          50:  '#fef3e2',
          200: '#fdba74',
          400: '#f97316',
          500: '#ea580c',
          600: '#c2410c',
        },
        teal:    { 400: '#0d9488' },
        amber:   { 400: '#d97706' },
        red:     { 400: '#dc2626' },
        green:   { 400: '#16a34a' },
        // ── v2 product-accent scales ─────────────────────────────────────
        rose:    { 200: '#fbcfe8', 400: '#ec4899' },  // Parent platform
        coral:   { 400: '#f43f5e' },                   // Student dashboard
        emerald: { 200: '#a7f3d0', 400: '#059669' },  // Tutor marketplace
        // ─────────────────────────────────────────────────────────────────
        line: {
          1: 'rgba(255,255,255,0.05)',
          2: 'rgba(255,255,255,0.08)',
          3: 'rgba(255,255,255,0.12)',
        },
      },
      fontFamily: {
        // Editorial / marketing / report cards — keeps the brand voice
        display: ['"Crimson Text"', 'Georgia', 'serif'],
        // v2 NEW — product UI headings (dashboard h1 / h2 / h3)
        heading: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        // Body copy — unchanged
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        // v2 SWAP: Space Grotesk → JetBrains Mono (better numeric clarity at small sizes)
        // Space Grotesk kept as fallback so any hardcoded font-mono still works during migration
        mono:    ['"JetBrains Mono"', '"Space Grotesk"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        // Display scale — Crimson Text (marketing pages + report card letterhead)
        'display-1': ['clamp(40px, 6vw, 68px)', { lineHeight: '1.05', letterSpacing: '-0.025em', fontWeight: '600' }],
        'display-2': ['clamp(30px, 4.4vw, 46px)', { lineHeight: '1.05', letterSpacing: '-0.02em', fontWeight: '600' }],
        'display-3': ['22px', { lineHeight: '1.2', letterSpacing: '-0.005em', fontWeight: '600' }],
        // Body — Inter
        'body-l': ['17px', { lineHeight: '1.55' }],
        'body':   ['14.5px', { lineHeight: '1.6' }],
        // Meta / eyebrow — JetBrains Mono
        'eyebrow': ['11px', { lineHeight: '1.2', letterSpacing: '0.18em' }],
        'meta':    ['11px', { lineHeight: '1.2', letterSpacing: '0.04em' }],
      },
      spacing: {
        // 4px base scale
        's-1': '4px',  's-2': '8px',  's-3': '12px', 's-4': '16px', 's-5': '20px',
        's-6': '24px', 's-7': '32px', 's-8': '40px', 's-9': '48px', 's-10': '64px',
      },
      borderRadius: {
        'r-1': '4px',
        'r-2': '8px',
        'r-3': '12px',
        'r-4': '16px',
        'r-5': '24px',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(0,0,0,.3), 0 8px 24px -12px rgba(0,0,0,.6)',
        lift: '0 4px 12px rgba(0,0,0,.45), 0 24px 48px -16px rgba(0,0,0,.7)',
        gold: '0 0 0 1px rgba(229,166,42,.25), 0 12px 32px -8px rgba(229,166,42,.18)',
      },
      transitionTimingFunction: {
        'out-soft': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      transitionDuration: {
        '150': '150ms',
        '250': '250ms',
      },
    },
  },
  plugins: [],
};
