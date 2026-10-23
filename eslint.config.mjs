import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

/** One lint config for the whole repo: TypeScript everywhere, React rules in the client. */
export default defineConfig([
  globalIgnores([
    '**/dist',
    'output',
    // Claude Code worktrees live inside the checkout; each is checked on its own.
    '.claude',
    'packages/client/android',
    'packages/client/ios',
    // Snippets run inside a browser page by Playwright, not modules.
    'scripts/browser',
  ]),
  {
    files: ['**/*.{ts,tsx,js,mjs}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    rules: {
      // A leading underscore marks a deliberately unused name.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['packages/client/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: { ecmaVersion: 2020, globals: globals.browser },
  },
  {
    files: ['packages/server/**/*.ts', 'packages/shared/**/*.ts', 'scripts/**', '*.{js,mjs}'],
    languageOptions: { ecmaVersion: 2022, globals: globals.node },
    // The server predates strict typing; its `any`s are tracked as warnings to burn down.
    rules: { '@typescript-eslint/no-explicit-any': 'warn' },
  },
]);
