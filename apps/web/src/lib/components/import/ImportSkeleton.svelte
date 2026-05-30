<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import Skeleton from '$lib/components/shared/Skeleton.svelte';
</script>

<div class="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1.2fr_1fr]">
	<!-- Left Side: Import Form Skeleton -->
	<Card.Root class="border-0 bg-white dark:bg-zinc-900 shadow-[0_4px_12px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.2)] overflow-hidden rounded-lg">
		<Card.Header>
			<Skeleton class="h-6 w-32" />
			<Skeleton class="mt-2 h-4 w-64" />
		</Card.Header>
		<Card.Content>
			<div class="rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/10 dark:bg-zinc-950/10 p-8">
				<Skeleton class="mx-auto h-12 w-12 rounded-full" />
				<Skeleton class="mx-auto mt-4 h-4 w-48" />
				<Skeleton class="mx-auto mt-2 h-4 w-32" />
				<Skeleton class="mx-auto mt-6 h-10 w-32" />
			</div>
		</Card.Content>
	</Card.Root>

	<!-- Right Side: History Skeleton -->
	<Card.Root class="border-0 bg-white dark:bg-zinc-900 shadow-[0_4px_12px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.2)] overflow-hidden rounded-lg">
		<Card.Header class="border-b border-zinc-100 dark:border-zinc-800 pb-3 bg-zinc-50/50 dark:bg-zinc-800/20">
			<Skeleton class="h-5 w-32" />
		</Card.Header>
		<Card.Content class="p-0">
			<div class="space-y-4 p-4">
				{#each Array(5) as _, i (i)}
					<div class="flex items-start justify-between gap-4">
						<div class="flex-1 space-y-2">
							<Skeleton class="h-4 w-3/4" />
							<Skeleton class="h-3 w-1/4" />
						</div>
						<Skeleton class="h-5 w-16 rounded-full" />
					</div>
				{/each}
			</div>
		</Card.Content>
	</Card.Root>
</div>
