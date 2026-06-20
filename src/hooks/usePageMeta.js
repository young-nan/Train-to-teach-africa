/**
 * src/hooks/usePageMeta.js
 *
 * Sets document.title and optional og:description for each public page.
 * No external dependency — uses a simple useEffect.
 * SSR note: this is CSR-only. For SSR/pre-render, migrate to react-helmet-async.
 */
import { useEffect } from 'react';

const BASE_TITLE = 'Train To Teach Africa';

/**
 * @param {string} title   - Page-specific title (appears before " — TTA")
 * @param {string} [description] - Optional meta description override
 */
export function usePageMeta(title, description) {
  useEffect(() => {
    const prev = document.title;
    document.title = title ? `${title} — ${BASE_TITLE}` : BASE_TITLE;

    if (description) {
      let meta = document.querySelector('meta[name="description"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'description';
        document.head.appendChild(meta);
      }
      const prevDesc = meta.content;
      meta.content = description;
      return () => {
        document.title = prev;
        meta.content = prevDesc;
      };
    }

    return () => { document.title = prev; };
  }, [title, description]);
}
