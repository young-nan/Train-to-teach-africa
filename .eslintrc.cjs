/* eslint-env node */
module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  settings: { react: { version: '18.3' } },
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
  rules: {
    'react/prop-types': 'off',
    'react/react-in-jsx-scope': 'off',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  },
  overrides: [
    {
      // Components MUST NOT import Supabase directly. They go through the
      // service layer. This rule is the architectural spine of the codebase.
      files: ['src/components/**', 'src/pages/**', 'src/modules/**'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            paths: [
              {
                name: '@supabase/supabase-js',
                message: 'Components must not import Supabase directly. Use a service in src/services/.',
              },
              {
                name: '@/lib/supabase',
                message: 'Components must not import the Supabase client. Use a service in src/services/.',
              },
            ],
          },
        ],
      },
    },
  ],
};
