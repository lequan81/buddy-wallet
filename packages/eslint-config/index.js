import { includeIgnoreFile } from '@eslint/compat';
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import sveltePlugin from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';

/**
 * Base ESLint config for JS/TS projects (No Svelte rules).
 * @type {import('eslint').Linter.Config[]}
 */
export const config = [
  js.configs.recommended,
  ...ts.configs.recommended,
  prettier,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    rules: {
      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_'
        }
      ]
    }
  },
  {
    ignores: ['dist/**', 'node_modules/**', 'build/**']
  }
];

/**
 * Svelte-specific ESLint config extension.
 * Consumers should spread `config` AND `svelteConfig`.
 * @type {import('eslint').Linter.Config[]}
 */
export const svelteConfig = [
  ...sveltePlugin.configs['flat/recommended'],
  ...sveltePlugin.configs['flat/prettier'],
  {
    files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
    languageOptions: {
      parserOptions: {
        parser: ts.parser
      }
    }
  },
  {
    ignores: ['.svelte-kit/**']
  }
];

// Re-export utilities
export { ts, sveltePlugin as svelte, globals, prettier, includeIgnoreFile };
