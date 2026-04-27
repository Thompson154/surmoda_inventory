import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import importPlugin from 'eslint-plugin-import';

// Production-grade flat config for the surmoda monorepo.
//
// Layered as:
//   1. global ignores
//   2. base recommended (ESLint + typescript-eslint) for ALL JS/TS
//   3. async-correctness + import hygiene for apps/**/*.{ts,tsx} (typed)
//   4. React hooks + a11y for apps/web/src only
//
// Some rules are deliberately demoted to `warn` instead of `error` because
// they fire on existing patterns whose refactor is scheduled for Tier 2.
// New code still surfaces the warning during review and on lint-staged.

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/node_modules/**',
      'apps/api/prisma/migrations/**',
      'apps/web/dev-dist/**',
      // Playwright E2E suite — outside any tsconfig project; lint via the
      // standalone playwright config when a polish pass needs it.
      'tests/e2e/**',
      'playwright.config.ts',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Async-correctness + import hygiene for application code (typed).
  {
    files: ['apps/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        project: ['./apps/api/tsconfig.json', './apps/web/tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { import: importPlugin },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],

      // Catch unhandled async — the highest-leverage rule of this batch.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      // Express handler types are `(req,res,next) => void` but our handlers
      // are async. The rule's defaults flag the idiomatic Express + React
      // onClick={asyncFn} patterns; relax `arguments` + `attributes` so the
      // rule still catches Promise-as-void-sink in OTHER contexts.
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { arguments: false, attributes: false } },
      ],

      // Import hygiene — keep blocks ordered + flag dependency cycles.
      'import/no-cycle': ['warn', { maxDepth: 4, ignoreExternal: true }],
      'import/order': [
        'warn',
        {
          groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index']],
          'newlines-between': 'never',
        },
      ],
    },
  },

  // React + a11y — only the FE workspace.
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'jsx-a11y': jsxA11y,
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactPlugin.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,

      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'react/prop-types': 'off',
      'react/no-unescaped-entities': 'off',
      'jsx-a11y/no-autofocus': 'off',

      // Demoted to warn: pre-existing patterns whose refactor lives in Tier 2.
      // New violations still show up in PR review; CI doesn't fail on them.
      'react-hooks/set-state-in-effect': 'warn',
      'react/no-children-prop': 'warn',
      'jsx-a11y/click-events-have-key-events': 'warn',
      'jsx-a11y/no-static-element-interactions': 'warn',
      'jsx-a11y/no-noninteractive-element-interactions': 'warn',
      'jsx-a11y/heading-has-content': 'warn',
    },
  },

  // Tooling/config files at the repo root (vite, vitest, pwa-assets) sit
  // outside any tsconfig project; allow them through with the untyped parser.
  {
    files: [
      'apps/web/vite.config.ts',
      'apps/web/vitest.config.ts',
      'apps/web/pwa-assets.config.ts',
    ],
    languageOptions: {
      parserOptions: { project: null, projectService: false },
    },
    rules: {
      // Typed rules are off here because they require a TS project.
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/await-thenable': 'off',
    },
  },
);
