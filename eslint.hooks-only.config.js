/**
 * eslint.hooks-only.config.js
 *
 * A minimal flat ESLint config used ONLY by `npm run lint:hooks`. The
 * full project config (eslint.config.js) has many style/format rules
 * with warnings we haven't cleaned up; running it on build would fail
 * for non-bug reasons.
 *
 * This config does ONE thing: catch Rules-of-Hooks violations (React
 * error #310) at error level. Anything else that passes ESLint here
 * passes the build.
 *
 * The previous attempt used legacy flags (--no-eslintrc, --rule); those
 * were removed in ESLint 9, which the project uses. A dedicated config
 * file is the supported path forward.
 */

import reactHooks from 'eslint-plugin-react-hooks';

export default [
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
    },
  },
];
