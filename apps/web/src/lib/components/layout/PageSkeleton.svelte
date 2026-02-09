<script lang="ts">
	let { lines = 6 }: { lines?: number } = $props();
</script>

<!-- Generic loading skeleton -->
<div class="space-y-6 animate-pulse">
	<div class="space-y-2">
		<div class="h-6 w-48 rounded bg-muted"></div>
		<div class="h-4 w-72 rounded bg-muted"></div>
	</div>
	<div class="h-px bg-border"></div>
	<div class="space-y-4">
		{#each Array(lines) as _}
			<div class="rounded-lg border p-4">
				<div class="flex items-center gap-4">
					<div class="h-10 w-10 rounded-full bg-muted shrink-0"></div>
					<div class="flex-1 space-y-2">
						<div class="h-4 w-3/4 rounded bg-muted"></div>
						<div class="h-3 w-1/2 rounded bg-muted"></div>
					</div>
				</div>
			</div>
		{/each}
	</div>
</div>
