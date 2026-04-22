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
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@lib/*', '@app/*', '@utils/*', '@/utils/*'],
              message: 'Use canonical imports: @/ or @infra/*.'
            }
          ]
        }
      ]
    }
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'warn',
        {
          patterns: [
            {
              group: ['@repo/db'],
              message:
                'Prefer repository/mappers as the only direct @repo/db consumers.'
            }
          ]
        }
      ]
    }
  },
  {
    files: [
      'src/app/Repositories/**/*.ts',
      'src/lib/mappers/**/*.ts',
      'src/lib/decorators/transactional.ts',
      'src/app/Providers/AppServiceProvider.ts',
      'src/app/Providers/Plugins/**/*.ts'
    ],
    rules: {
      'no-restricted-imports': 'off'
    }
  },
  {
    files: ['src/app/Http/Controllers/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@repo/db', '@/app/Repositories/Database/*'],
              message: 'Controllers must flow through Actions, not DB/repositories.'
            },
            {
              group: ['@/app/Services/*'],
              message: 'Controllers should depend on Actions as their use-case boundary.'
            }
          ]
        }
      ]
    }
  },
  {
    files: ['src/app/Services/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/app/Http/Controllers/*', '@/app/Http/Mappers/*'],
              message: 'Services cannot import controllers or HTTP mappers.'
            }
          ]
        }
      ]
    }
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn'
      // No need to disable no-unused-vars anymore, as the crash was due to Svelte parser
    }
  }
];
