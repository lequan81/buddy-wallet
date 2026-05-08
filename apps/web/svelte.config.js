import { mdsvex } from 'mdsvex';
import adapter from 'svelte-adapter-bun';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('mdsvex').MdsvexOptions} */
const mdsvexOptions = {
	extensions: ['.md', '.svx']
};

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: [vitePreprocess(), mdsvex(mdsvexOptions)],

	compilerOptions: {
		experimental: {
			async: true
		}
	},
	kit: {
		experimental: {
			remoteFunctions: true
		},
		output: {
			preloadStrategy: 'preload-js'
		},
		inlineStyleThreshold: 4096,
		typescript: {
			config: (tsconfig) => ({
				...tsconfig
			})
		},
		// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
		// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
		// See https://svelte.dev/docs/kit/adapters for more information about adapters.
		adapter: adapter(),
		alias: {
			$contents: 'src/contents',
			'@repo/icons': '../../packages/icons/src',
			'@repo/config': '../../packages/config/src',
			'@repo/utils': '../../packages/utils/src',
			'@repo/schema': '../../packages/schema/src',
			'@repo/schema/*': '../../packages/schema/src/*',
			'@repo/types': '../../packages/types/src',
			'@repo/errors': '../../packages/errors'
		},
		paths: {
			base: '',
			assets: ''
		},
		serviceWorker: {
			register: false // Service worker registration handled by @vite-pwa/sveltekit
		},
		files: {
			serviceWorker: 'src/service-worker/index.ts'
		}
	},
	extensions: ['.svelte', '.svx', '.md']
};

export default config;
