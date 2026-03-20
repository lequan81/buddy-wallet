<script lang="ts">
	import { navigating } from '$app/stores';

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

{#if visible || progress > 0}
	<div
		class="fixed top-0 right-0 left-0 z-100 h-0.5 bg-linear-to-r from-primary via-primary/80 to-primary transition-all duration-300 ease-out"
		style="width: {Math.min(progress, 100)}%; opacity: {progress >= 100 ? 0 : 1}"
	></div>
{/if}
