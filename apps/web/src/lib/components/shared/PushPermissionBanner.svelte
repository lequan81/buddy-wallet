<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, slide } from 'svelte/transition';
	import {
		pushState,
		initializePushState,
		subscribeToPush,
		dismissBanner,
		shouldShowBanner
	} from '$lib/push.svelte';

	let visible = $state(false);
	let isSubscribing = $state(false);

	onMount(async () => {
		await initializePushState();
		// Small delay to prevent flash on page load
		setTimeout(() => {
			visible = shouldShowBanner();
		}, 1500);
	});

	// Watch for permission changes
	$effect(() => {
		if (pushState.permission !== 'prompt' || pushState.isSubscribed) {
			visible = false;
		}
	});

	async function handleEnable() {
		isSubscribing = true;
		const success = await subscribeToPush();
		isSubscribing = false;

		if (success) {
			visible = false;
		}
	}

	function handleDismiss() {
		dismissBanner(false); // Temporary dismiss (7 days)
		visible = false;
	}

	function handleNeverShow() {
		dismissBanner(true); // Permanent dismiss
		visible = false;
	}
</script>

{#if visible}
	<!-- Mobile: Top banner -->
	<div class="fixed top-0 right-0 left-0 z-50 p-4 md:hidden" transition:slide={{ duration: 300 }}>
		<div
			class="relative rounded-lg border border-border bg-card p-4 shadow-lg"
			in:fade={{ duration: 200, delay: 100 }}
		>
			<!-- Close button -->
			<button
				type="button"
				onclick={handleDismiss}
				class="absolute top-2 right-2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
				aria-label="Dismiss"
			>
				<IconLucideX class="h-4 w-4" />
			</button>

			<div class="flex items-start gap-3">
				<!-- Icon -->
				<div
					class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
				>
					<IconLucideBell class="h-5 w-5" />
				</div>

				<!-- Content -->
				<div class="flex-1 pr-6">
					<h3 class="font-semibold text-foreground">Enable Notifications</h3>
					<p class="mt-1 text-sm text-muted-foreground">
						Get notified about debt reminders and payment updates.
					</p>

					<!-- Actions -->
					<div class="mt-3 flex flex-wrap items-center gap-2">
						<button
							type="button"
							onclick={handleEnable}
							disabled={isSubscribing || pushState.isLoading}
							class="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
						>
							{#if isSubscribing || pushState.isLoading}
								<span
									class="mr-2 h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
								></span>
								Enabling...
							{:else}
								Enable
							{/if}
						</button>

						<button
							type="button"
							onclick={handleNeverShow}
							class="inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
						>
							Don't ask again
						</button>
					</div>

					<!-- Error message -->
					{#if pushState.error}
						<p class="mt-2 text-xs text-destructive">{pushState.error}</p>
					{/if}
				</div>
			</div>
		</div>
	</div>

	<!-- Desktop: Bottom-right corner -->
	<div
		class="fixed right-4 bottom-4 z-50 hidden max-w-sm md:block"
		transition:slide={{ duration: 300 }}
	>
		<div
			class="relative rounded-lg border border-border bg-card p-4 shadow-lg"
			in:fade={{ duration: 200, delay: 100 }}
		>
			<!-- Close button -->
			<button
				type="button"
				onclick={handleDismiss}
				class="absolute top-2 right-2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
				aria-label="Dismiss"
			>
				<IconLucideX class="h-4 w-4" />
			</button>

			<div class="flex items-start gap-3">
				<!-- Icon -->
				<div
					class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
				>
					<IconLucideBell class="h-5 w-5" />
				</div>

				<!-- Content -->
				<div class="flex-1 pr-6">
					<h3 class="font-semibold text-foreground">Enable Notifications</h3>
					<p class="mt-1 text-sm text-muted-foreground">
						Get notified about debt reminders, payment updates, and important alerts.
					</p>

					<!-- Actions -->
					<div class="mt-3 flex flex-wrap items-center gap-2">
						<button
							type="button"
							onclick={handleEnable}
							disabled={isSubscribing || pushState.isLoading}
							class="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
						>
							{#if isSubscribing || pushState.isLoading}
								<span
									class="mr-2 h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
								></span>
								Enabling...
							{:else}
								Enable
							{/if}
						</button>

						<button
							type="button"
							onclick={handleNeverShow}
							class="inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
						>
							Don't ask again
						</button>
					</div>

					<!-- Error message -->
					{#if pushState.error}
						<p class="mt-2 text-xs text-destructive">{pushState.error}</p>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}
