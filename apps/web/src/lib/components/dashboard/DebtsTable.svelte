<script lang="ts">
	import * as Card from '@repo/ui/components/ui/card';
	import * as Table from '@repo/ui/components/ui/table';
	import { Button } from '@repo/ui/components/ui/button';
	import { Plus, FileText } from '@repo/icons';
	import type { Debt } from '@repo/types/core/debt';
	import DebtsTableToolbar from './DebtsTableToolbar.svelte';
	import DebtsTableHeader from './DebtsTableHeader.svelte';
	import DebtsTableRow from './DebtsTableRow.svelte';
	import DebtsTablePagination from './DebtsTablePagination.svelte';
	import type { DashboardState } from '$lib/dashboard/state.svelte';


	interface Permissions {
		isAdmin: boolean;
	}

	interface Props {
		debts: Debt[];
		dashState: DashboardState;
		permissions: Permissions;
		onOpenCreateModal: () => void;
	}

	let {
		debts,
		dashState,
		permissions,
		onOpenCreateModal
	}: Props = $props();

	// Derived sorted/filtered debts for the view
	let filteredDebts = $derived.by(() => {
		let result = debts;
		if (dashState.statusFilter !== 'all') {
			result = result.filter((debt) => debt.status === dashState.statusFilter);
		}
		const query = dashState.debouncedSearch.trim().toLowerCase();
		if (!query) return result;
		return result.filter((debt) => {
			const description = (debt.description || '').toLowerCase();
			const status = (debt.status || '').toLowerCase();
			const amount = String(debt.amount);
			const phone = `${debt.debtorPhone || ''} ${debt.creditorPhone || ''}`.toLowerCase();
			return (
				description.includes(query) ||
				status.includes(query) ||
				amount.includes(query) ||
				phone.includes(query)
			);
		});
	});

	let sortedDebts = $derived.by(() => {
		return [...filteredDebts].sort((a, b) => {
			let comparison = 0;
			switch (dashState.sortField) {
				case 'description':
					comparison = (a.description || '').localeCompare(b.description || '');
					break;
				case 'status':
					comparison = a.status.localeCompare(b.status);
					break;
				case 'amount':
					comparison = a.amount - b.amount;
					break;
				case 'date':
					comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
					break;
			}
			return dashState.sortDirection === 'asc' ? comparison : -comparison;
		});
	});

	let totalItems = $derived(sortedDebts.length);
	let totalPagesValue = $derived(Math.max(1, Math.ceil(totalItems / dashState.pageSize)));

	let displayedDebts = $derived(
		sortedDebts.slice(
			(dashState.currentPage - 1) * dashState.pageSize,
			dashState.currentPage * dashState.pageSize
		)
	);

	let allSelectedOnPage = $derived(
		displayedDebts.length > 0 && displayedDebts.every((d) => dashState.selectedIds.has(d.id))
	);

	const buildPageItems = (current: number, total: number) => {
		if (total <= 1) return [1];
		const set = new Set<number>([1, total, current - 1, current, current + 1]);
		const pages = Array.from(set)
			.filter((p) => p >= 1 && p <= total)
			.sort((a, b) => a - b);
		const items: Array<number | 'ellipsis'> = [];
		for (let i = 0; i < pages.length; i++) {
			const pageNum = pages[i];
			const prev = pages[i - 1];
			if (i > 0 && prev !== undefined && pageNum - prev > 1) {
				items.push('ellipsis');
			}
			items.push(pageNum);
		}
		return items;
	};

	let pageItems = $derived(buildPageItems(dashState.currentPage, totalPagesValue));
</script>

<Card.Root>
	<Card.Header>
		<DebtsTableToolbar 
			{dashState} 
			hasDebts={debts.length > 0} 
			{onOpenCreateModal} 
			isAdmin={permissions.isAdmin}
		>
			{#snippet title()}
				<Card.Title class="text-lg">Transactions</Card.Title>
			{/snippet}
		</DebtsTableToolbar>
	</Card.Header>

	{#if sortedDebts.length === 0}
		<div class="flex flex-col items-center justify-center py-12 text-center">
			<div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
				<FileText class="h-8 w-8 text-muted-foreground" />
			</div>

			<h3 class="mb-2 text-lg font-semibold">No debts found</h3>

			<p class="mb-6 max-w-sm text-sm text-muted-foreground">
				{dashState.statusFilter === 'all' ? 'Create a debt to get started' : `No ${dashState.statusFilter} debts found`}
			</p>

			{#if dashState.statusFilter === 'all'}
				<Button onclick={onOpenCreateModal} variant="outline" size="sm" class="shadow-sm">
					<Plus class="mr-2 h-4 w-4" /> New Debt
				</Button>
			{/if}
		</div>
	{:else}
		<Table.Root>
			<DebtsTableHeader {dashState} {allSelectedOnPage} {displayedDebts} />
			<Table.Body>
				{#each displayedDebts as debt (debt.id)}
					<DebtsTableRow {debt} {dashState} />
				{/each}
			</Table.Body>
		</Table.Root>

		<DebtsTablePagination 
			{dashState} 
			{totalItems} 
			{totalPagesValue} 
			{pageItems} 
		/>
	{/if}
</Card.Root>
