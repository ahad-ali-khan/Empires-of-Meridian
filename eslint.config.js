import tseslint from 'typescript-eslint';

export default [
  ...tseslint.configs.recommended,
  {
    ignores: ['**/dist/**', '**/node_modules/**', 'playwright-report/**', 'test-results/**'],
  },
  {
    files: ['**/*.{js,ts}'],
    rules: {
      'no-console': 'warn',
      'no-debugger': 'error',
    },
  },
];
