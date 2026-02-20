import path from 'path';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vite';
import Icons from 'unplugin-icons/vite';
import AutoImport from 'unplugin-auto-import/vite';
import IconsResolver from 'unplugin-icons/resolver';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		paraglideVitePlugin({ project: './project.inlang', outdir: './src/lib/paraglide' }),
		AutoImport({
			resolvers: [
				IconsResolver({
					prefix: 'Icon', // Viết <IconMdiAlarm /> để tự import mdi:alarm
					extension: 'svelte'
				})
			],
			dts: 'src/auto-imports.d.ts'
		}),
		Icons({
			compiler: 'svelte',
			autoInstall: true // Tự động tải bộ icon khi bạn gọi tên nó
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
				screenshots: [],
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
				maximumFileSizeToCacheInBytes: 3 * 1024 * 1024 // 3MB
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
			'@elysiajs/eden'
		],
		exclude: ['@repo/ui', '@repo/config', '@repo/errors', '@repo/permissions']
	},
	ssr: {
		noExternal: ['@repo/ui'],
		external: ['async_hooks']
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
		warmup: {
			clientFiles: [
				'src/routes/(app)/+page.svelte',
				'src/routes/(auth)/login/+page.svelte',
				'src/routes/(admin)/+layout.svelte',
				'src/lib/components/**/*.svelte'
			]
		}
	}
});
