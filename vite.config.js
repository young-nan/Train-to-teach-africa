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
    // -----------------------------------------------------------------------
    // No manualChunks. Earlier versions of this config tried to split React,
    // Supabase, and TanStack Query into named chunks for cache-friendliness.
    // That produced two production-only bugs in succession:
    //   1. "useState of undefined" — React's consumers ended up split across
    //      different chunks from React itself, with wrong load order.
    //   2. "Ks before initialization" — circular chunk dependency
    //      (vendor → react-vendor → vendor).
    //
    // Vite's automatic splitting is good. It uses code analysis to avoid
    // circular chunks and out-of-order evaluation. The cache-hit-rate gain
    // from a hand-tuned chunk strategy is small; the bug surface is large.
    //
    // Each lazy-loaded route still gets its own chunk via the dynamic
    // imports in `src/routes/index.jsx` — that's where the real splitting
    // lives, and it's safe because Vite tracks the dependency graph.
    // -----------------------------------------------------------------------
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
  },
});
