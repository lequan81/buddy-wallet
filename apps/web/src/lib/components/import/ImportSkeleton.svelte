<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import Skeleton from '$lib/components/shared/Skeleton.svelte';
</script>

<div class="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1.2fr_1fr]">
	<!-- Left Side: Import Form Skeleton -->
	<Card.Root>
		<Card.Header>
			<Skeleton class="h-6 w-32" />
			<Skeleton class="mt-2 h-4 w-64" />
		</Card.Header>
		<Card.Content>
			<div class="rounded-lg border-2 border-dashed p-8">
				<Skeleton class="mx-auto h-12 w-12 rounded-full" />
				<Skeleton class="mx-auto mt-4 h-4 w-48" />
				<Skeleton class="mx-auto mt-2 h-4 w-32" />
				<Skeleton class="mx-auto mt-6 h-10 w-32" />
			</div>
		</Card.Content>
	</Card.Root>

	<!-- Right Side: History Skeleton -->
	<Card.Root>
		<Card.Header class="border-b pb-3">
			<Skeleton class="h-5 w-32" />
		</Card.Header>
		<Card.Content class="p-0">
			<div class="space-y-4 p-4">
				{#each Array(5) as _}
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
