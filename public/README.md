# public/

Static assets served at the site root by Vite — no bundling, no hashing.
A file at `public/foo.png` is served at `https://yoursite.com/foo.png`.

## What's here

| File                    | Purpose |
|-------------------------|---------|
| `favicon.svg`           | Browser tab icon. Inline SVG so it scales and stays under 1 KB. |
| `robots.txt`            | Crawler policy. Marketing pages indexed; `/app`, `/auth`, `/billing` blocked. |
| `manifest.webmanifest`  | PWA manifest — required for "Install app" on Android. |
| `sitemap.xml`           | Static sitemap for the five marketing routes. |

## What's still needed before launch

These files are **referenced** by `index.html` / the manifest but not yet
created — bitmap PNGs cannot be authored in this format. Generate them
once before launch:

| File         | Purpose                                              | How to make it |
|--------------|------------------------------------------------------|----------------|
| `og.jpg`     | Open Graph image (1200×630) for link previews.       | Design once in Figma; export at 1200×630, < 200 KB. |
| `icon-192.png` | PWA icon for Android home screen.                  | Export `favicon.svg` at 192×192, transparent bg. |
| `icon-512.png` | PWA splash + larger Android variant.               | Export at 512×512, transparent bg. |
| `apple-touch-icon.png` | iOS home screen icon (180×180).            | Export at 180×180, white bg (iOS won't honour transparency). |

Once those four PNGs are in `public/`, add this to `index.html`'s `<head>`:

```html
<link rel="manifest" href="/manifest.webmanifest" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
```

## What does NOT belong here

- Anything that should be hashed for cache-busting → put in `src/assets/` and `import` it.
- Anything large (> 500 KB) → use Supabase Storage with a signed URL.
- Lesson images / videos → never. Those go in Supabase Storage.

The rule of thumb: if losing this file would break SEO or PWA install,
it goes here. Everything else gets imported.
