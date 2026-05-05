# Brand Guidelines

The Train To Teach Africa identity, codified.

This document is the rulebook for anyone — engineer, marketer, freelance
designer, school-onboarding rep — placing the logo on something. Read it
once, then refer back when in doubt.

---

## The mark — Compass-Sun

A single geometric mark fusing three references:

1. A **rising sun** — the dominant gesture. Five rays radiate from a
   half-circle horizon. Reads from a distance; recognisable at 16px.
2. A **compass rose** — the two faint lower rays close the circle and
   suggest direction-finding. We are an *operating system* for
   education; orientation is the metaphor.
3. A **TT monogram** — knocked out of the horizon's interior. The
   wordmark anchor. Drops away below ~24px — the favicon doesn't try
   to render it visibly, that's intentional.

### Construction grid

The mark sits in a 100×100 viewBox. The horizon centre is at (50, 50).
- Cardinal rays extend from radius 18 to radius 32 (length 14)
- Ordinal rays extend from radius 18 to radius 32 (length ~14, at 45°)
- Lower-quadrant rays extend from radius 14 to radius 24 (length ~10, 40% opacity)
- Horizon: 22 unit radius half-circle, closed by a horizontal line
- TT monogram: crossbar at y=-5.5, stems descend to y=7

Stroke widths are anchored to the 100-unit grid:
- Rays: 4 (cardinals + ordinals), 3 (lower-quadrant secondaries)
- Horizon: 3.5
- TT monogram: 3.5

---

## Variants — when to use which

| Variant   | Stroke colour | Surface            | Use for |
|-----------|---------------|--------------------|---------|
| `gold`    | Gold          | Dark (transparent) | The 90% case. Marketing site, app shell, dark surfaces. |
| `dark`    | Dark navy     | Light (transparent)| Invoices, contracts, school certificates, white papers. |
| `inverse` | Gold          | Dark navy filled   | Favicons, app icons, social profile pictures. Has chrome. |
| `mono`    | currentColor  | Transparent        | Embroidery, screen-print, fax, single-channel reproduction. No TT monogram. |

In React: `<Mark variant="gold" surfaceColor="#0d0f1a" />`. The
`surfaceColor` prop is the colour the TT monogram knocks out in — must
match the actual background you're rendering on, otherwise the
monogram won't look clean.

---

## The wordmark

"Train To Teach Africa" — set in **Crimson Text** (the editorial
display face from the design system).

- "Train To Teach" — semibold (600), ink-0 colour (white on dark, near-black on light)
- "Africa" — italic regular (400), gold-200 colour

Set on one line whenever possible. Two lines (Train To Teach / *Africa*)
only inside the app sidebar where horizontal space is constrained.
Never three lines. Never ALL CAPS. Never centred unless the whole
composition is centred.

---

## Lockup — mark + wordmark

The default lockup places the mark to the **left** of the wordmark, mark
height ≈ 1.5× the cap-height of the wordmark, gap ≈ 0.5× the wordmark
cap-height.

Three sizes:
- `sm` — 16px wordmark, 24px mark (header navs, dense surfaces)
- `md` — 22px wordmark, 32px mark (auth panels, marketing footers)
- `lg` — 32px wordmark, 44px mark (hero sections)

Use `<Logo size="md" />` from `@/components/brand`. Don't compose the
mark and wordmark by hand.

### Vertical lockup (rare)

Mark above, wordmark below, both centred. Use ONLY when the
horizontal lockup will not fit and the surface is square. Spacing:
mark bottom edge to wordmark cap-height = 1× the mark's diameter.

---

## Spacing — the clear-space rule

Maintain clear space around the mark equal to the height of the **TT
monogram** — roughly 12% of the mark's total size. Nothing — text,
photo edge, button, frame — sits inside this clear-space ring.

In the marketing nav, the entire 64px header is the clear space. In
the app sidebar, the 24px padding around the lockup is the clear
space. Don't crowd it.

---

## Sizing — minimums by context

| Context                  | Minimum mark size |
|--------------------------|-------------------|
| Browser favicon          | 16×16 (use the `inverse` variant — no TT visible) |
| App sidebar              | 24×24 |
| Marketing nav            | 24×24 (in lockup) |
| Print collateral         | 28×28 (8mm) |
| Embroidery / screen print| 40×40 (use `mono` variant) |

Below the minimums, drop a complexity layer in this order:
1. Lower-quadrant rays first (already 40% opacity — they vanish naturally)
2. TT monogram next (drops at favicon size)
3. Cardinal/ordinal ray distinction last (at extreme small sizes, equalise)

---

## Hard rules — the don'ts

These are not stylistic preferences. Doing any of these breaks the
brand and we will fix it:

1. **Don't recolour.** Two colours only — gold (`#e5a62a`) and dark
   navy (`#0d0f1a`). Never red, never green, never "team colours."
2. **Don't put the mark on a busy photo.** The horizon's interior is
   transparent in the gold/dark variants — it picks up whatever's
   behind it. If you must place on a photo, use the `inverse` variant
   (chrome encloses it).
3. **Don't squish, stretch, or rotate.** The mark is geometrically
   precise; aspect-ratio breaks immediately read as off.
4. **Don't add effects.** No drop shadow, no glow, no outline beyond
   what's defined, no embossing, no gradient.
5. **Don't separate the mark and wordmark inside the same surface.**
   Either lock them up or use the mark alone. Never put the mark in a
   header and the wordmark unaccompanied in a footer of the same page.
6. **Don't use the placeholder "book" mark in any new asset.** It was
   replaced; if you find it in old slide decks or older artefacts,
   please update.
7. **Don't translate the wordmark.** Always "Train To Teach Africa,"
   even on Yoruba/Hausa/Igbo surfaces. The brand is the brand.

---

## In code

All five contexts in the app render the lockup through one component.
If you find yourself inlining `<svg>` for the mark, stop and import:

```jsx
import { Mark, Logo, Wordmark } from '@/components/brand';

<Mark size={28} variant="gold" surfaceColor="#13162a" />
<Logo size="md" surfaceColor="#0d0f1a" />
<Wordmark size="lg" />
```

The `surfaceColor` prop is required when the surface isn't `#0d0f1a`
(the default `surface-1`). Common cases:

| Where                    | surfaceColor   |
|--------------------------|----------------|
| Marketing pages          | `#0d0f1a`      |
| App sidebar              | `#13162a` (`surface-2`) |
| Auth brand panel         | `#13162a`      |
| Modal / elevated surface | `#1a1d30` (`surface-3`) |

---

## Standalone files

For non-React contexts — slide decks, email signatures, print, social
profiles — use the static SVGs in `public/brand-assets/`:

| File                          | Use for |
|-------------------------------|---------|
| `mark-gold-on-dark.svg`       | Slide decks with dark backgrounds |
| `mark-dark-on-light.svg`      | Invoices, contracts, white slide decks |
| `mark-app-icon.svg`           | Social profiles, app store listings |
| `mark-monochrome.svg`         | Embroidery, screen-print, single-channel |
| `lockup-on-dark.svg`          | Email signatures, dark slide intros |
| `lockup-on-light.svg`         | Letterheads, light slide intros |

PNG versions (for contexts that don't accept SVG, like older WhatsApp
profile uploads) are not in the repo — export from the SVGs at the
size you need using any vector tool.

---

## Brand voice — adjacent reminder

The mark is half the brand. The other half is the way we *write*. Three
quick reminders, since they tend to drift faster than the mark does:

1. **Lowercase, sentence case** in product copy. "Mark attendance," not
   "Mark Attendance" or "MARK ATTENDANCE."
2. **Specific over generic.** "Cut a pancake into halves" beats
   "engage with maths." We name things.
3. **Africa-first, not Africa-also.** When tempted to write "also
   suitable for African schools," rewrite to "built for African
   schools." We are not an afterthought.
