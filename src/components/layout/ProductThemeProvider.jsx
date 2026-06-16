/**
 * ProductThemeProvider
 * Sets --product-accent and --product-glow on the wrapping div
 * so every child component adapts automatically to the current role surface.
 */

const THEMES = {
  admin:      { accent: '#e5a62a', glow: 'rgba(229,166,42,0.10)' },
  sims:       { accent: '#22b8a6', glow: 'rgba(34,184,166,0.10)' },
  parent:     { accent: '#fb7185', glow: 'rgba(251,113,133,0.10)' },
  student:    { accent: '#f97066', glow: 'rgba(249,112,102,0.10)' },
  tutor:      { accent: '#10b981', glow: 'rgba(16,185,129,0.10)' },
  superadmin: { accent: '#7c3aed', glow: 'rgba(124,58,237,0.10)' },
};

export function ProductTheme({ surface = 'admin', children }) {
  const theme = THEMES[surface] ?? THEMES.admin;
  return (
    <div
      style={{
        '--product-accent': theme.accent,
        '--product-glow': theme.glow,
      }}
      className="contents"
    >
      {children}
    </div>
  );
}
