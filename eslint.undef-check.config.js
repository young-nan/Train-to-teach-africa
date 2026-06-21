/**
 * eslint.undef-check.config.js
 *
 * NOT part of the normal build (npm run lint:hooks only checks hooks
 * rules — see that file's own comment for why). This config exists because
 * a real production bug (ReferenceError: MOCK_SCHOOLS is not defined)
 * shipped past every check I had: Babel's parser only validates syntax,
 * not whether referenced identifiers exist; Vite's bundler doesn't do
 * whole-program undefined-variable analysis either. ESLint's no-undef
 * rule is the actual tool for this class of bug — leftover references to
 * a deleted variable/array after a refactor — and I should run this
 * manually on any file I edit from now on, not just trust a clean build.
 */
export default [
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        window: 'readonly', document: 'readonly', console: 'readonly',
        fetch: 'readonly', localStorage: 'readonly', sessionStorage: 'readonly',
        navigator: 'readonly', URL: 'readonly', Blob: 'readonly',
        setTimeout: 'readonly', clearTimeout: 'readonly',
        setInterval: 'readonly', clearInterval: 'readonly',
        Promise: 'readonly', Set: 'readonly', Map: 'readonly',
        FormData: 'readonly', FileReader: 'readonly',
        process: 'readonly',
        crypto: 'readonly', indexedDB: 'readonly', Image: 'readonly',
        requestAnimationFrame: 'readonly', cancelAnimationFrame: 'readonly',
        WebSocket: 'readonly', Notification: 'readonly',
      },
    },
    rules: {
      'no-undef': 'error',
    },
  },
];
