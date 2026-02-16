<script lang="ts">
	import * as Card from '@repo/ui/components/ui/card';
</script>

<!-- Skeleton loading state for dashboard -->
<div class="animate-pulse space-y-6">
	<!-- Financial Summary Skeleton -->
	<div class="grid gap-4 md:grid-cols-2">
		<div class="rounded-lg border p-6">
			<div class="mb-3 h-4 w-24 rounded bg-muted"></div>
			<div class="h-8 w-40 rounded bg-muted"></div>
		</div>
		<div class="rounded-lg border p-6">
			<div class="mb-3 h-4 w-24 rounded bg-muted"></div>
			<div class="h-8 w-40 rounded bg-muted"></div>
		</div>
	</div>

	<!-- Stats Grid Skeleton -->
	<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
		{#each Array(3) as _}
			<Card.Root>
				<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
					<div class="h-4 w-20 rounded bg-muted"></div>
					<div class="h-4 w-4 rounded bg-muted"></div>
				</Card.Header>
				<Card.Content>
					<div class="h-10 w-16 rounded bg-muted"></div>
					<div class="mt-2 h-3 w-24 rounded bg-muted"></div>
				</Card.Content>
			</Card.Root>
		{/each}
	</div>

	<!-- Table Skeleton -->
	<Card.Root>
		<Card.Header>
			<div class="mb-1 h-5 w-32 rounded bg-muted"></div>
			<div class="h-4 w-48 rounded bg-muted"></div>
		</Card.Header>
		<Card.Content class="px-0">
			<div class="space-y-3 px-6">
				{#each Array(5) as _}
					<div class="flex items-center gap-4 border-b py-3 last:border-0">
						<div class="h-4 w-4 rounded bg-muted"></div>
						<div class="h-4 w-40 flex-1 rounded bg-muted"></div>
						<div class="h-5 w-16 rounded-full bg-muted"></div>
						<div class="h-4 w-24 rounded bg-muted"></div>
						<div class="h-4 w-20 rounded bg-muted"></div>
						<div class="h-4 w-4 rounded bg-muted"></div>
					</div>
				{/each}
			</div>
		</Card.Content>
	</Card.Root>
</div>
