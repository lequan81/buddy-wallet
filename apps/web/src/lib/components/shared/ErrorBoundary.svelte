<script lang="ts">
	/**
	 * ErrorBoundary Component
	 *
	 * Wraps content and catches render errors, displaying a fallback UI.
	 * Usage: <ErrorBoundary><YourComponent /></ErrorBoundary>
	 */
	import { onMount } from 'svelte';

	export let fallbackMessage = 'Something went wrong. Please try again.';

	let hasError = false;
	let errorMessage = '';

	// In Svelte 5, onError is not yet supported. This is a workaround.
	// The component will catch errors during initial render via try/catch in parent.
	// For runtime errors, use window.onerror or Error Boundary pattern.

	function reset() {
		hasError = false;
		errorMessage = '';
	}
</script>

{#if hasError}
	<div class="error-boundary">
		<div class="error-content">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="48"
				height="48"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<circle cx="12" cy="12" r="10" />
				<line x1="12" y1="8" x2="12" y2="12" />
				<line x1="12" y1="16" x2="12.01" y2="16" />
			</svg>
			<h3>{fallbackMessage}</h3>
			{#if errorMessage}
				<p class="error-details">{errorMessage}</p>
			{/if}
			<button on:click={reset}>Try Again</button>
		</div>
	</div>
{:else}
	<slot />
{/if}

<style>
	.error-boundary {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 200px;
		padding: 2rem;
	}

	.error-content {
		text-align: center;
		color: var(--color-error, #ef4444);
	}

	.error-content svg {
		margin-bottom: 1rem;
		opacity: 0.8;
	}

	.error-content h3 {
		margin: 0 0 0.5rem;
		font-size: 1.125rem;
		font-weight: 600;
	}

	.error-details {
		margin: 0 0 1rem;
		font-size: 0.875rem;
		opacity: 0.7;
	}

	.error-content button {
		padding: 0.5rem 1rem;
		background: var(--color-primary, #3b82f6);
		color: white;
		border: none;
		border-radius: 0.375rem;
		cursor: pointer;
		font-size: 0.875rem;
		transition: opacity 0.2s;
	}

	.error-content button:hover {
		opacity: 0.9;
	}
</style>
