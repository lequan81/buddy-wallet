import path from 'path';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vite';
import Icons from 'unplugin-icons/vite';

export default defineConfig({
	// PERFORMANCE: Explicitly disable features that slow startup in dev
	envPrefix: 'VITE_',

	// PERFORMANCE: Skip preprocessing for faster cold starts
	css: {
		devSourcemap: false
	},

	// PERFORMANCE: Reduce bundle operations in dev mode
	build: {
		// Only used for production, but set explicitly to avoid any overhead
		reportCompressedSize: false,
		// Disable sourcemaps in dev entirely
		sourcemap: false,
		rollupOptions: {
			external: ['bun']
		}
	},
	plugins: [
		tailwindcss(),
		sveltekit(),
		paraglideVitePlugin({ project: './project.inlang', outdir: './src/lib/paraglide' }),
		Icons({
			compiler: 'svelte',
			autoInstall: false
		}),
		VitePWA({
			strategies: 'injectManifest',
			srcDir: 'src/service-worker',
			filename: 'index.ts',
			registerType: 'autoUpdate',
			injectRegister: 'auto',
			scope: '/',
			base: '/',
			includeAssets: ['favicon.ico', 'icons/*.png', 'robots.txt'],
			pwaAssets: {
				disabled: false,
				config: true
			},
			manifest: {
				name: 'Buddy Wallet',
				short_name: 'BuddyWallet',
				description: 'Manage group expenses and settle debts easily',
				theme_color: '#3B82F6',
				background_color: '#ffffff',
				display: 'standalone',
				display_override: ['window-controls-overlay', 'standalone'],
				orientation: 'portrait-primary',
				scope: '/',
				start_url: '/',
				categories: ['finance', 'productivity'],
				icons: [
					{
						src: '/icons/pwa-192x192.png',
						sizes: '192x192',
						type: 'image/png'
					},
					{
						src: '/icons/pwa-512x512.png',
						sizes: '512x512',
						type: 'image/png'
					},
					{
						src: '/icons/pwa-512x512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable'
					}
				],
				screenshots: [
					{
						src: '/icons/screenshot-wide.png',
						sizes: '1280x720',
						type: 'image/png',
						form_factor: 'wide',
						label: 'Buddy Wallet Dashboard'
					},
					{
						src: '/icons/screenshot-narrow.png',
						sizes: '750x1334',
						type: 'image/png',
						form_factor: 'narrow',
						label: 'Buddy Wallet Mobile View'
					}
				],
				shortcuts: [
					{
						name: 'Dashboard',
						short_name: 'Dashboard',
						url: '/dashboard',
						icons: [{ src: '/icons/pwa-192x192.png', sizes: '192x192' }]
					},
					{
						name: 'New Debt',
						short_name: 'New Debt',
						url: '/debts/create',
						icons: [{ src: '/icons/pwa-192x192.png', sizes: '192x192' }]
					}
				]
			},
			injectManifest: {
				globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2}'],
				// Increase the max file size for precaching (default is 2MB)
				maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3MB
				rollupFormat: 'iife',
				rollupOptions: {
					external: ['@repo/api', 'bun'] // Absolutely prevent Rollup from traversing and bundling server backend modules into the service worker
				}
			},
			devOptions: {
				enabled: false,
				suppressWarnings: true,
				type: 'module',
				navigateFallback: '/'
			}
		})
	],
	optimizeDeps: {
		include: [
			'clsx',
			'tailwind-merge',
			'tailwind-variants',
			'bits-ui',
			'formsnap',
			'svelte-sonner',
			'sveltekit-superforms',
			'valibot',
			'@elysiajs/eden',
			// Add common UI dependencies for faster startup
			'@internationalized/date',
			'@inlang/paraglide-js'
		],
		exclude: ['@repo/ui', '@repo/config', '@repo/errors', '@repo/permissions']
	},
	ssr: {
		noExternal: ['@repo/ui'],
		external: ['async_hooks', 'bun'] // Extends Node's async_hooks with Bun to prevent rollup crash on API imports
	},
	resolve: {
		dedupe: ['svelte'],
		alias: {
			'@repo/ui/lib/utils.js': path.resolve(__dirname, '../../packages/ui/src/lib/utils.ts')
		}
	},
	cacheDir: '.vite',
	server: {
		fs: { strict: false },
		// Proxy API requests to the separate Elysia dev server (bun --watch)
		// This replaces the old elysia-middleware plugin.
		// Benefits: full header forwarding (cookies!), streaming bodies, multipart uploads,
		// no API deps in Vite's module graph, proper process isolation.
		proxy: {
			'/v1': {
				target: 'http://localhost:3000',
				changeOrigin: true
			},
			'/health': {
				target: 'http://localhost:3000',
				changeOrigin: true
			}
		},
		// PERFORMANCE: Increase HMR performance
		hmr: {
			// Use overlay but don't block on errors
			overlay: false
		},
		// PERFORMANCE: Pre-transform common files
		warmup: {
			clientFiles: [
				'src/routes/(app)/+page.svelte',
				'src/routes/(auth)/login/+page.svelte',
				'src/routes/(admin)/+layout.svelte'
			]
		}
	}
});
