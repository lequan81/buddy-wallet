<script lang="ts">
	import { Button } from '@repo/ui/components/ui/button';
	import * as Select from '@repo/ui/components/ui/select';
	import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from '@repo/icons';

	interface Props {
		readonly dashState: any;
		readonly totalItems: number;
		readonly totalPagesValue: number;
		readonly pageItems: Array<number | 'ellipsis'>;
	}

	let { dashState, totalItems, totalPagesValue, pageItems }: Props = $props();
</script>

<div class="flex flex-wrap items-center justify-between gap-3 border-t px-6 py-4">
	<div class="flex items-center gap-2 text-sm text-muted-foreground">
		<span>
			Showing {(dashState.currentPage - 1) * dashState.pageSize + 1} to {Math.min(
				dashState.currentPage * dashState.pageSize,
				totalItems
			)} of {totalItems} debts
		</span>
		<Select.Root
			value={dashState.pageSize.toString()}
			onValueChange={(v) => dashState.setPageSize(parseInt(v))}
		>
			<Select.Trigger class="ml-2 h-8 w-auto rounded border px-2 py-1 text-sm font-medium">
				<Select.Value />
			</Select.Trigger>
			<Select.Content>
				<Select.Item value="5" label="5 per page" />
				<Select.Item value="10" label="10 per page" />
				<Select.Item value="25" label="25 per page" />
				<Select.Item value="50" label="50 per page" />
			</Select.Content>
		</Select.Root>
	</div>
	<div class="flex items-center gap-2">
		<Button
			variant="outline"
			size="icon"
			class="h-8 w-8"
			disabled={dashState.currentPage <= 1}
			onclick={() => dashState.setPage(1)}
		>
			<ChevronsLeft class="h-4 w-4" />
		</Button>
		<Button
			variant="outline"
			size="icon"
			class="h-8 w-8"
			disabled={dashState.currentPage <= 1}
			onclick={() => dashState.setPage(dashState.currentPage - 1)}
		>
			<ChevronLeft class="h-4 w-4" />
		</Button>
		{#each pageItems as item, index (index)}
			{#if item === 'ellipsis'}
				<span class="px-2 text-sm text-muted-foreground">...</span>
			{:else}
				<Button
					variant={item === dashState.currentPage ? 'default' : 'outline'}
					size="sm"
					class="h-8 min-w-8 px-2"
					onclick={() => dashState.setPage(item)}
				>
					{item}
				</Button>
			{/if}
		{/each}
		<Button
			variant="outline"
			size="icon"
			class="h-8 w-8"
			disabled={dashState.currentPage >= totalPagesValue}
			onclick={() => dashState.setPage(dashState.currentPage + 1)}
		>
			<ChevronRight class="h-4 w-4" />
		</Button>
		<Button
			variant="outline"
			size="icon"
			class="h-8 w-8"
			disabled={dashState.currentPage >= totalPagesValue}
			onclick={() => dashState.setPage(totalPagesValue)}
		>
			<ChevronsRight class="h-4 w-4" />
		</Button>
	</div>
</div>
