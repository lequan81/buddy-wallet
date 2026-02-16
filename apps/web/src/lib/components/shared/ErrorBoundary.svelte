<script lang="ts">
	/**
	 * ErrorBoundary Component
	 *
	 * Wraps content and catches render errors using Svelte 5's <svelte:boundary>.
	 * Usage: <ErrorBoundary><YourComponent /></ErrorBoundary>
	 */
	import { RotateCcw, AlertTriangle } from '@lucide/svelte';

	let { children, fallbackMessage = 'Something went wrong. Please try again.' } = $props();
</script>

<svelte:boundary>
	{@render children?.()}

	{#snippet failed(error, reset)}
		<div class="flex min-h-50 flex-col items-center justify-center p-8 text-center text-red-500">
			<AlertTriangle class="mb-4 h-12 w-12 opacity-80" />
			<h3 class="mb-2 text-lg font-semibold">{fallbackMessage}</h3>
			<p class="mb-4 text-sm opacity-70">
				{error instanceof Error ? error.message : String(error)}
			</p>
			<button
				onclick={reset}
				class="rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600 hover:opacity-90"
			>
				<span class="flex items-center gap-2">
					<RotateCcw class="h-4 w-4" />
					Try Again
				</span>
			</button>
		</div>
	{/snippet}
</svelte:boundary>
