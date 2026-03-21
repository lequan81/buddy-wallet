<script lang="ts">
	import { AlertTriangle, X } from '@repo/icons';
	import { onMount } from 'svelte';
	import { onNavigate } from '$app/navigation';
	import { Toaster } from 'svelte-sonner';
	import { useRegisterSW } from 'virtual:pwa-register/svelte';
	import PageLoadingBar from '$lib/components/shared/PageLoadingBar.svelte';
	import GlobalProgressToast from '$lib/components/shared/GlobalProgressToast.svelte';
	import ErrorBoundary from '$lib/components/shared/ErrorBoundary.svelte';
	import favicon from '$lib/assets/favicon.svg';
	import '@repo/ui/layout.css';
	import '../app.css';

	let mounted = $state(false);

	onMount(() => {
		mounted = true;
		document.documentElement.dataset.hydrated = 'true';

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

	// ── View Transitions API ──────────────────────────────
	// Creates smooth crossfade transitions between pages.
	// Supported: Chrome 111+, Edge 111+. Gracefully degrades on others.
	onNavigate((navigation) => {
		// Skip if View Transitions API is not available
		if (!document.startViewTransition) return;

		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
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

<!-- Global Progress Toast -->
<GlobalProgressToast />

<!-- Toast Notifications (client-only to prevent hydration mismatch) -->
{#if mounted}
	<Toaster richColors position="top-center" duration={3500} />
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
<div style="display: contents" {@attach () => {
	const globalLoader = document.getElementById('global-loader');
	if (globalLoader) {
		globalLoader.style.opacity = '0';
		setTimeout(() => globalLoader.remove(), 400);
	}
}}>
	<ErrorBoundary>
		{@render children()}
	</ErrorBoundary>
</div>
