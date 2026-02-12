import { paraglideVitePlugin } from '@inlang/paraglide-js';
import devtoolsJson from 'vite-plugin-devtools-json';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		devtoolsJson(),
		paraglideVitePlugin({ project: './project.inlang', outdir: './src/lib/paraglide' }),
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
				enabled: true,
				suppressWarnings: true,
				type: 'module',
				navigateFallback: '/'
			}
		})
	],
	optimizeDeps: {
		include: [
			'@repo/ui',
			'@lucide/svelte',
			'clsx',
			'tailwind-merge',
			'bits-ui',
			'formsnap',
			'svelte-sonner'
		]
	},
	ssr: {
		noExternal: ['@repo/ui']
	},
	resolve: {
		dedupe: ['svelte']
	}
});
