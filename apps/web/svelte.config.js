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
		// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
		// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
		// See https://svelte.dev/docs/kit/adapters for more information about adapters.
		adapter: adapter(),
		alias: {
			$contents: 'src/contents',
			'@repo/icons': '../../packages/icons/src',
			'@repo/config': '../../packages/config/src',
			'@repo/utils': '../../packages/utils/src',
			'@repo/validation': '../../packages/validation',
			'@repo/types': '../../packages/types/src',
			'@repo/errors': '../../packages/errors',
			// API Internal aliases for type resolution
			'@plugins': '../api/src/plugins',
			'@plugins/*': '../api/src/plugins/*',
			'@controllers': '../api/src/controllers',
			'@controllers/*': '../api/src/controllers/*',
			'@services': '../api/src/services',
			'@services/*': '../api/src/services/*',
			'@repositories': '../api/src/repositories',
			'@repositories/*': '../api/src/repositories/*',
			'@states': '../api/src/states',
			'@states/*': '../api/src/states/*',
			'@storage': '../api/src/services/storage',
			'@storage/*': '../api/src/services/storage/*',
			'@api-types': '../api/src/types',
			'@api-types/*': '../api/src/types/*',
			'@utils': '../api/src/utils',
			'@utils/phone': '../api/src/utils/phone.utils.ts',
			'@utils/trace-store': '../api/src/utils/trace-store.utils.ts',
			'@utils/crypto': '../api/src/utils/crypto.utils.ts',
			'@utils/database': '../api/src/utils/database.utils.ts',
			'@utils/ip': '../api/src/utils/ip.utils.ts',
			'@utils/cursor': '../api/src/utils/cursor.utils.ts',
			'@utils/device': '../api/src/utils/device.utils.ts',
			'@utils/html': '../api/src/utils/html.utils.ts',
			'@utils/password': '../api/src/utils/password.utils.ts',
			'@utils/security-logger': '../api/src/utils/security-logger.utils.ts',
			'@utils/user-mapping': '../api/src/utils/user-mapping.utils.ts',
			'@utils/*': '../api/src/utils/*',
			'@configs': '../api/src/configs.ts',
			'@configs/*': '../api/src/configs/*',
			'@core': '../api/src/core',
			'@core/*': '../api/src/core/*',
			'@shared': '../api/src/shared',
			'@shared/*': '../api/src/shared/*',
			'@domain': '../api/src/domain',
			'@domain/*': '../api/src/domain/*',
			'@modules': '../api/src/modules',
			'@modules/*': '../api/src/modules/*'
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
