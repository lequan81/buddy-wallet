<script lang="ts">
	import { Download } from '@repo/icons';
	import { onMount } from 'svelte';
	import { fade, slide } from 'svelte/transition';
	import { Button } from '@repo/ui/components/ui/button';
	import { getCookie, setCookie } from '$lib/utils/cookie-utils';

	interface BeforeInstallPromptEvent extends Event {
		prompt: () => Promise<{ outcome: 'accepted' | 'dismissed' }>;
		userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
	}

	let deferredPrompt = $state<BeforeInstallPromptEvent | null>(null);
	let visible = $state(false);
	let installed = $state(false);

	onMount(() => {
		// Don't show if already installed as PWA
		if (window.matchMedia('(display-mode: standalone)').matches) {
			installed = true;
			return;
		}

		// Don't show if user permanently dismissed
		if (getCookie('bw-pwa-dismissed') === 'permanent') {
			return;
		}

		// Check temporary dismissal (7 days) — cookie auto-expires
		const dismissedTemp = getCookie('bw-pwa-dismissed-temp');
		if (dismissedTemp) return;

		window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
		window.addEventListener('appinstalled', handleAppInstalled);

		return () => {
			window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
			window.removeEventListener('appinstalled', handleAppInstalled);
		};
	});

	function handleBeforeInstallPrompt(e: Event) {
		e.preventDefault();
		deferredPrompt = e as BeforeInstallPromptEvent;
		// Small delay to avoid flash on page load
		setTimeout(() => {
			visible = true;
		}, 2000);
	}

	function handleAppInstalled() {
		installed = true;
		visible = false;
		deferredPrompt = null;
	}

	async function handleInstall() {
		if (!deferredPrompt) return;
		const result = await deferredPrompt.prompt();
		if (result.outcome === 'accepted') {
			installed = true;
			visible = false;
		}
		deferredPrompt = null;
	}

	function handleDismiss() {
		setCookie('bw-pwa-dismissed-temp', 'true', 7);
		visible = false;
	}
</script>

{#if visible && !installed}
	<!-- Desktop: Outline Button -->
	<Button
		variant="outline"
		size="sm"
		class="hidden items-center gap-2 md:flex"
		onclick={handleInstall}
		title="Install Buddy Wallet App"
	>
		<Download class="h-4 w-4" />
		Install App
	</Button>

	<!-- Mobile: Ghost Icon Button -->
	<Button
		variant="ghost"
		size="icon"
		class="text-muted-foreground hover:bg-muted md:hidden"
		onclick={handleInstall}
		title="Install Buddy Wallet App"
	>
		<Download class="h-5 w-5" />
	</Button>
{/if}
