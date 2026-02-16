import { config, includeIgnoreFile } from '@repo/eslint-config';
import { fileURLToPath } from 'node:url';

const gitignorePath = fileURLToPath(new URL('./.gitignore', import.meta.url));

export default [
  includeIgnoreFile(gitignorePath),
  {
    ignores: ['dist/**', '**/src/types/**']
  },
  ...config,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn'
      // No need to disable no-unused-vars anymore, as the crash was due to Svelte parser
    }
  }
];
