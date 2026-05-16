<script lang="ts">
	import * as Table from '@repo/ui/components/ui/table';
	import { CheckSquare, Square, ArrowUp, ArrowDown, ArrowUpDown } from '@repo/icons';

	interface Props {
		readonly dashState: any;
		readonly allSelectedOnPage: boolean;
		readonly displayedDebts: any[];
	}

	let { dashState, allSelectedOnPage, displayedDebts }: Props = $props();
</script>

<Table.Header>
	<Table.Row>
		<Table.Head class="w-12 pl-6">
			<button
				class="flex items-center justify-center"
				onclick={() => dashState.toggleSelectAll(displayedDebts)}
				title={allSelectedOnPage ? 'Deselect all' : 'Select all deletable'}
			>
				{#if allSelectedOnPage}
					<CheckSquare class="h-4 w-4 text-foreground" />
				{:else}
					<Square class="h-4 w-4 text-muted-foreground" />
				{/if}
			</button>
		</Table.Head>
		<Table.Head>
			<button
				class="flex items-center gap-1 hover:text-foreground"
				onclick={() => dashState.toggleSort('description')}
			>
				Description
				{#if dashState.sortField === 'description'}
					{#if dashState.sortDirection === 'asc'}<ArrowUp class="h-3 w-3" />{:else}<ArrowDown
							class="h-3 w-3"
						/>{/if}
				{:else}
					<ArrowUpDown class="h-3 w-3 opacity-50" />
				{/if}
			</button>
		</Table.Head>
		<Table.Head>
			<button
				class="flex items-center gap-1 hover:text-foreground"
				onclick={() => dashState.toggleSort('status')}
			>
				Status
				{#if dashState.sortField === 'status'}
					{#if dashState.sortDirection === 'asc'}<ArrowUp class="h-3 w-3" />{:else}<ArrowDown
							class="h-3 w-3"
						/>{/if}
				{:else}
					<ArrowUpDown class="h-3 w-3 opacity-50" />
				{/if}
			</button>
		</Table.Head>
		<Table.Head class="text-right">
			<button
				class="ml-auto flex items-center gap-1 hover:text-foreground"
				onclick={() => dashState.toggleSort('amount')}
			>
				Amount
				{#if dashState.sortField === 'amount'}
					{#if dashState.sortDirection === 'asc'}<ArrowUp class="h-3 w-3" />{:else}<ArrowDown
							class="h-3 w-3"
						/>{/if}
				{:else}
					<ArrowUpDown class="h-3 w-3 opacity-50" />
				{/if}
			</button>
		</Table.Head>
		<Table.Head>
			<button
				class="flex items-center gap-1 hover:text-foreground"
				onclick={() => dashState.toggleSort('date')}
			>
				Date
				{#if dashState.sortField === 'date'}
					{#if dashState.sortDirection === 'asc'}<ArrowUp class="h-3 w-3" />{:else}<ArrowDown
							class="h-3 w-3"
						/>{/if}
				{:else}
					<ArrowUpDown class="h-3 w-3 opacity-50" />
				{/if}
			</button>
		</Table.Head>
		<Table.Head class="pr-6 text-right">Actions</Table.Head>
	</Table.Row>
</Table.Header>
