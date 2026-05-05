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
    chunkSizeWarningLimit: 200, // hard budget — see PERFORMANCE.md
    rollupOptions: {
      output: {
        // Manual chunks keep initial JS payload under the 180 KB gz budget by
        // separating heavy authenticated-app code from marketing-site code.
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('scheduler')) return 'react-vendor';
            if (id.includes('@supabase')) return 'supabase';
            if (id.includes('@tanstack')) return 'query';
            return 'vendor';
          }
          if (id.includes('/src/modules/')) {
            const m = id.match(/\/modules\/([^/]+)/);
            if (m) return `module-${m[1]}`;
          }
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
