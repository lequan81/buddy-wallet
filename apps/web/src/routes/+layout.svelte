<script lang="ts">
	import { onMount } from 'svelte';
	import { AlertTriangle, X } from '@lucide/svelte';
	import { Toaster } from 'svelte-sonner';
	import { useRegisterSW } from 'virtual:pwa-register/svelte';
	import PageLoadingBar from '$lib/components/shared/PageLoadingBar.svelte';
	import favicon from '$lib/assets/favicon.svg';
	import './layout.css';

	let mounted = $state(false);

	onMount(() => {
		mounted = true;

		useRegisterSW({
			onRegisteredSW(swScriptUrl, registration) {
				console.log('[SW] Service worker registered:', swScriptUrl);
				console.log('[SW] Registration:', registration);
			},
			onOfflineReady() {
				console.log('[SW] App ready to work offline');
			}
		});

		// NOTE: Removed pages-cache clearing on every page load.
		// The service worker now uses proper caching strategies:
		// - NetworkOnly for API requests (always fresh)
		// - StaleWhileRevalidate for navigations (fast + background update)
		// - CacheFirst for static assets
		// Clearing the cache on every load defeated the purpose of navigation caching.
	});

	

	let { children, data } = $props();
	let showOfflineWarning = $state(true);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Buddy Wallet</title>
	<meta name="description" content="Buddy Wallet - Manage group expenses and settle debts easily" />
</svelte:head>

<!-- Page Loading Bar -->
<PageLoadingBar />

<!-- Toast Notifications (client-only to prevent hydration mismatch) -->
{#if mounted}
	<Toaster richColors position="top-center" />
{/if}

<!-- API Offline Warning Banner -->
{#if data.apiOffline && showOfflineWarning}
	<div
		class="fixed top-0 right-0 left-0 z-100 flex items-center justify-center gap-2 bg-yellow-500/95 p-2 text-sm font-medium text-yellow-950 backdrop-blur"
	>
		<AlertTriangle class="h-4 w-4" />
		<span>Backend API is offline. Some features may be unavailable.</span>
		<button
			onclick={() => (showOfflineWarning = false)}
			class="ml-2 rounded p-1 hover:bg-yellow-600/30"
		>
			<X class="h-4 w-4" />
		</button>
	</div>
{/if}

<!-- Page Content (layouts handled by route groups) -->
{@render children()}
