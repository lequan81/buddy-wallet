<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { AlertTriangle, X } from '@lucide/svelte';
	import { Toaster } from 'svelte-sonner';

	let { children, data } = $props();
	let showOfflineWarning = $state(true);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Buddy Wallet</title>
	<meta name="description" content="Buddy Wallet - Manage group expenses and settle debts easily" />
</svelte:head>

<!-- Toast Notifications -->
<Toaster richColors position="top-center" />

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
