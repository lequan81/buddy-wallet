import { config, svelteConfig, includeIgnoreFile } from '@repo/eslint-config';
import { fileURLToPath } from 'node:url';
import svelteConfigFile from './svelte.config.js';

const gitignorePath = fileURLToPath(new URL('./.gitignore', import.meta.url));

export default [
	includeIgnoreFile(gitignorePath),
	...config,
	...svelteConfig,
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				svelteConfig: svelteConfigFile
			}
		},
		rules: {
			'svelte/no-navigation-without-resolve': 'off',
			'svelte/require-each-key': 'off',
			'@typescript-eslint/no-explicit-any': 'warn'
		}
	},
	{
		// Prevent accidental runtime imports from @repo/api
		// Only type imports from @repo/api/types are allowed
		files: ['**/*.ts', '**/*.js', '**/*.svelte.ts'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					paths: [
						{
							name: '@repo/api',
							message: 'Runtime imports from @repo/api are forbidden. Use: import type { ... } from "@repo/api/types"'
						}
					],
					patterns: [
						{
							group: ['@repo/api/*'],
							importNamePattern: '^(?!types$).*',
							message: 'Only @repo/api/types is allowed. Use: import type { ... } from "@repo/api/types"'
						}
					]
				}
			]
		}
	}
];
