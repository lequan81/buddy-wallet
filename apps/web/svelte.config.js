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

	kit: {
		// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
		// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
		// See https://svelte.dev/docs/kit/adapters for more information about adapters.
		adapter: adapter(),
		alias: {
			// 	'@repo/api': '../api/src/index.ts',
			// 	'@repo/db': '../../packages/db/index.ts'
			$contents: 'src/contents'
		},
		serviceWorker: {
			register: false // Service worker registration handled by @vite-pwa/sveltekit
		}
	},
	files: {
		serviceWorker: 'src/service-worker/index.ts'
	},
	extensions: ['.svelte', '.svx', '.md']
};

export default config;
