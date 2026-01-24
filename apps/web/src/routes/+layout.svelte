<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { locales, localizeHref } from '$lib/paraglide/runtime';
	import BlankLayout from '$lib/layouts/BlankLayout.svelte';
	import GuestLayout from '$lib/layouts/GuestLayout.svelte';
	import AuthedLayout from '$lib/layouts/AuthedLayout.svelte';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import MainHeader from '$lib/components/layout/MainHeader.svelte';
	import { AlertTriangle, X } from '@lucide/svelte';
	import { Toaster } from 'svelte-sonner';

	let { children, data } = $props();
	let showOfflineWarning = $state(true);

	// Smart Layout Switcher Logic
	let LayoutComponent = $derived.by(() => {
		if (data.layout === 'blank') return BlankLayout;
		if (data.layout === 'guest') return GuestLayout;
		if (data.layout === 'authed') return AuthedLayout;

		if (data.user) return AuthedLayout;
		return GuestLayout;
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Buddy Wallet</title>
	<meta name="description" content="Buddy Wallet" />
</svelte:head>

<!-- Toast Notifications -->
<Toaster richColors position="top-center" />

<!-- API Offline Warning Banner -->
{#if data.apiOffline && showOfflineWarning}
	<div class="fixed top-0 left-0 right-0 z-100 p-2 bg-yellow-500/95 text-yellow-950 flex items-center justify-center gap-2 text-sm font-medium backdrop-blur">
		<AlertTriangle class="h-4 w-4" />
		<span>Backend API is offline. Some features may be unavailable.</span>
		<button onclick={() => showOfflineWarning = false} class="ml-2 p-1 hover:bg-yellow-600/30 rounded">
			<X class="h-4 w-4" />
		</button>
	</div>
{/if}

<!-- Global Header -->
<MainHeader />

<!-- Render the selected layout -->
<LayoutComponent>
	{@render children()}
</LayoutComponent>

<div style="display:none">
	{#each locales as locale}
		<a href={localizeHref(page.url.pathname, { locale })}>
			{locale}
		</a>
	{/each}
</div>
