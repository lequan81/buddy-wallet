<script lang="ts">
	import { navigating } from '$app/stores';
	import { onMount } from 'svelte';

	let progress = $state(0);
	let visible = $derived($navigating !== null);
	let intervalId: ReturnType<typeof setInterval> | null = null;

	// Simulate progress when navigating
	$effect(() => {
		if (visible) {
			progress = 10;
			intervalId = setInterval(() => {
				if (progress < 90) {
					progress += Math.random() * 15;
				}
			}, 200);
		} else {
			if (intervalId) clearInterval(intervalId);
			progress = 100;
			// Reset after animation completes
			setTimeout(() => {
				progress = 0;
			}, 300);
		}

		return () => {
			if (intervalId) clearInterval(intervalId);
		};
	});
</script>

{#if visible || progress >= 100}
	<div
		class="fixed left-0 right-0 top-0 z-100 h-1 bg-primary transition-all duration-300 ease-out"
		style="width: {progress}%"
	></div>
{/if}
