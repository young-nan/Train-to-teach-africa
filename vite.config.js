import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 200,
    rollupOptions: {
      output: {
        // -------------------------------------------------------------------
        // Manual chunking — read this before changing.
        //
        // The brittle thing about chunking React is that React + ReactDOM +
        // scheduler + every package that imports React (react-router,
        // @tanstack/react-query, etc) all share a single React instance.
        // If you split React into one chunk and a React consumer into
        // another, the consumer can evaluate before React finishes parsing —
        // producing the classic `useState of undefined` runtime error.
        //
        // Rule: put React, ReactDOM, scheduler, and every "react-*" or
        // "*-react-*" dependency into ONE chunk. Anything that doesn't
        // touch React (Supabase JS, Zod, lodash) can live elsewhere safely.
        // Use exact path delimiters (`/react/`) — never bare substring
        // (`react`) which matches "react-router", "react-is", etc. by
        // accident and causes split-React bugs.
        // -------------------------------------------------------------------
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            // Application code — split each module into its own chunk so
            // the teacher app doesn't ship parent-app code, etc.
            if (id.includes('/src/modules/')) {
              const m = id.match(/\/modules\/([^/]+)/);
              if (m) return `module-${m[1]}`;
            }
            return undefined; // let Vite handle the rest
          }

          // React core + everything that imports React → one chunk.
          // The path delimiters (slashes) keep this from over-matching.
          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/scheduler/') ||
            id.includes('/react-router') ||           // react-router + react-router-dom
            id.includes('/@tanstack/react-query/') ||
            id.includes('/use-sync-external-store/') ||
            id.includes('/react-is/')
          ) {
            return 'react-vendor';
          }

          // Supabase is large and only loaded in authed flows — its own chunk.
          if (id.includes('/@supabase/')) return 'supabase';

          // Everything else (zod, clsx, etc) into a single small vendor chunk.
          return 'vendor';
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
  },
});
