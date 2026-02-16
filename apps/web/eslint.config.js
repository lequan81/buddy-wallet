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
	}
];
