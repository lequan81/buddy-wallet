<script lang="ts">
	let { lines = 6 }: { lines?: number } = $props();
</script>

<!-- Generic loading skeleton -->
<div class="animate-pulse space-y-6">
	<div class="space-y-2">
		<div class="h-6 w-48 rounded bg-muted"></div>
		<div class="h-4 w-72 rounded bg-muted"></div>
	</div>
	<div class="h-px bg-zinc-100 dark:bg-zinc-800"></div>
	<div class="space-y-4">
		{#each Array(lines) as _, i (i)}
			<div class="rounded-lg border-0 bg-white dark:bg-zinc-900 shadow-[0_4px_12px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.2)] p-4">
				<div class="flex items-center gap-4">
					<div class="h-10 w-10 shrink-0 rounded-full bg-muted"></div>
					<div class="flex-1 space-y-2">
						<div class="h-4 w-3/4 rounded bg-muted"></div>
						<div class="h-3 w-1/2 rounded bg-muted"></div>
					</div>
				</div>
			</div>
		{/each}
	</div>
</div>
