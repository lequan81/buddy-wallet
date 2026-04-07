<script lang="ts">
	import * as Card from '@repo/ui/components/ui/card';
	import * as Table from '@repo/ui/components/ui/table';
	import { Button } from '@repo/ui/components/ui/button';
	import * as AlertDialog from '@repo/ui/components/ui/alert-dialog';
	import { 
		Search, X, Filter, Trash2, CheckSquare, Square, 
		ArrowUp, ArrowDown, ArrowUpDown, Eye, Plus, FileText,
		ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight
	} from '@repo/icons';
	import { cn } from '$lib/utils';
	import { formatCurrency } from '@repo/utils';
	import type { Debt } from '@repo/types';
	import { resolve } from '$app/paths';
	import DebtStatusBadge from '$lib/components/DebtStatusBadge.svelte';
	import { batchDeleteDebts, deleteDebt, deleteAllDebts } from '$lib/remotes/debts.remote';
	import { invalidateAll } from '$app/navigation';

	interface DashboardState {
		readonly selectedIds: Set<string>;
		isSubmitting: boolean;
		deleteId: string;
		isDeleting: boolean;
		searchQuery: string;
		readonly debouncedSearch: string;
		readonly sortField: string;
		readonly sortDirection: 'asc' | 'desc';
		canDeleteDebt: (debt: { uploadedById?: string; status?: string }) => boolean;
		toggleSelect: (id: string) => void;
		toggleSelectAll: (items: { id: string }[]) => void;
		clearSelection: () => void;
		toggleSort: (field: string) => void;
		navigateWithParams: (params: { page?: number; pageSize?: number; status?: string }) => void;
		handleFilterChange: (newStatus: string) => void;
	}

	interface Permissions {
		isAdmin: boolean;
	}

	interface Props {
		debts: Debt[];
		pagination: { total: number };
		dashState: DashboardState;
		permissions: Permissions;
		statusFilter: string;
		pageSize: number;
		currentPage: number;
		onOpenCreateModal: () => void;
	}

	let { 
		debts, 
		pagination, 
		dashState, 
		permissions, 
		statusFilter,
		pageSize,
		currentPage,
		onOpenCreateModal
	}: Props = $props();

	// Derived sorted/filtered debts for the view
	// Note: We expect `debts` to be raw state from the parent
	let filteredDebts = $derived.by(() => {
		const query = dashState.debouncedSearch.trim().toLowerCase();
		if (!query) return debts;
		return debts.filter((debt) => {
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

	let allSelectedOnPage = $derived(
		sortedDebts.length > 0 && sortedDebts.every((d) => dashState.selectedIds.has(d.id))
	);

	let totalPagesValue = $derived(Math.max(1, Math.ceil(pagination.total / pageSize)));

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

	let pageItems = $derived(buildPageItems(currentPage, totalPagesValue));
</script>

<Card.Root>
	<Card.Header>
		<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<Card.Title class="text-lg">Transactions</Card.Title>
				<Card.Description>
					{permissions.isAdmin ? 'All system debts' : 'Your debt records'}
				</Card.Description>
			</div>

			<!-- Filter & Bulk Actions -->
			<div class="flex flex-wrap items-center gap-2">
				<!-- Search Input -->
				<div class="relative">
					<Search class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<input
						type="text"
						placeholder="Search debts..."
						bind:value={dashState.searchQuery}
						class="h-9 w-48 rounded-md border bg-background pr-8 pl-9 text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none"
					/>
					{#if dashState.searchQuery}
						<button
							onclick={() => (dashState.searchQuery = '')}
							class="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
						>
							<X class="h-4 w-4" />
						</button>
					{/if}
				</div>

				<!-- Status Filter -->
				<div class="flex items-center gap-1 rounded-lg border p-1">
					<Filter class="ml-1 h-4 w-4 text-muted-foreground" />
					{#each ['all', 'pending', 'confirmed', 'paid', 'disputed', 'cancelled'] as status}
						<button
							class={cn(
								'rounded px-2 py-1 text-xs font-medium transition-colors',
								statusFilter === status
									? 'bg-muted text-foreground'
									: 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
							)}
							onclick={() => dashState.handleFilterChange(status)}
						>
							{status.charAt(0).toUpperCase() + status.slice(1)}
						</button>
					{/each}
				</div>

				<!-- Bulk Delete Button -->
				{#if dashState.selectedIds.size > 0}
					<AlertDialog.Root>
						<AlertDialog.Trigger>
							{#snippet child({ props }: { props: Record<string, unknown> })}
								<Button variant="destructive" size="sm" {...props}>
									<Trash2 class="mr-2 h-4 w-4" />
									Delete ({dashState.selectedIds.size})
								</Button>
							{/snippet}
						</AlertDialog.Trigger>
						<AlertDialog.Content>
							<AlertDialog.Header>
								<AlertDialog.Title>Delete Selected Debts</AlertDialog.Title>
								<AlertDialog.Description>
									Are you sure you want to delete {dashState.selectedIds.size} debt(s)? This action
									cannot be undone.
								</AlertDialog.Description>
							</AlertDialog.Header>
							<AlertDialog.Footer>
								<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
								<form
									{...batchDeleteDebts.enhance(async ({ submit }) => {
										dashState.isSubmitting = true;
										try {
											await submit();
										} finally {
											dashState.isSubmitting = false;
											dashState.clearSelection();
											invalidateAll();
										}
									})}
								>
									<input type="hidden" name="ids" value={Array.from(dashState.selectedIds)} />
									<AlertDialog.Action
										type="submit"
										class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
									>
										{dashState.isSubmitting ? 'Deleting...' : 'Delete'}
									</AlertDialog.Action>
								</form>
							</AlertDialog.Footer>
						</AlertDialog.Content>
					</AlertDialog.Root>
				{/if}

				<!-- Delete all debts (with confirmation) -->
				{#if debts.length > 0}
					<AlertDialog.Root>
						<AlertDialog.Trigger>
							{#snippet child({ props }: { props: Record<string, unknown> })}
								<Button variant="outline" size="sm" {...props}>
									<Trash2 class="mr-2 h-4 w-4" />
									Delete all
								</Button>
							{/snippet}
						</AlertDialog.Trigger>
						<AlertDialog.Content>
							<AlertDialog.Header>
								<AlertDialog.Title>Delete all debts</AlertDialog.Title>
								<AlertDialog.Description>
									Are you sure you want to delete all your debts? This action cannot be undone.
								</AlertDialog.Description>
							</AlertDialog.Header>
							<AlertDialog.Footer>
								<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
								<form
									{...deleteAllDebts.enhance(async ({ submit }) => {
										dashState.isSubmitting = true;
										try {
											await submit();
										} finally {
											dashState.isSubmitting = false;
											invalidateAll();
										}
									})}
								>
									<input type="hidden" name="confirm" value="true" />
									<AlertDialog.Action
										type="submit"
										class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
									>
										{dashState.isSubmitting ? 'Deleting...' : 'Delete all'}
									</AlertDialog.Action>
								</form>
							</AlertDialog.Footer>
						</AlertDialog.Content>
					</AlertDialog.Root>
				{/if}
			</div>
		</div>
	</Card.Header>

	{#if sortedDebts.length === 0}
		<div class="flex flex-col items-center justify-center py-12 text-center">
			<div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
				<FileText class="h-8 w-8 text-muted-foreground" />
			</div>

			<h3 class="mb-2 text-lg font-semibold">No debts found</h3>

			<p class="mb-6 max-w-sm text-sm text-muted-foreground">
				{statusFilter === 'all' ? 'Create a debt to get started' : `No ${statusFilter} debts found`}
			</p>

			{#if statusFilter === 'all'}
				<Button onclick={onOpenCreateModal} variant="outline" size="sm" class="shadow-sm">
					<Plus class="mr-2 h-4 w-4" /> New Debt
				</Button>
			{/if}
		</div>
	{:else}
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head class="w-12 pl-6">
						<button
							class="flex items-center justify-center"
							onclick={() => dashState.toggleSelectAll(sortedDebts)}
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
			<Table.Body>
				{#each sortedDebts as debt (debt.id)}
					{@const canDelete = dashState.canDeleteDebt(debt)}
					<Table.Row class={cn(dashState.selectedIds.has(debt.id) && 'bg-muted/50')}>
						<Table.Cell class="pl-6">
							{#if canDelete}
								<button
									class="flex items-center justify-center"
									onclick={() => dashState.toggleSelect(debt.id)}
								>
									{#if dashState.selectedIds.has(debt.id)}
										<CheckSquare class="h-4 w-4 text-foreground" />
									{:else}
										<Square class="h-4 w-4 text-muted-foreground" />
									{/if}
								</button>
							{:else}
								<span class="h-4 w-4"></span>
							{/if}
						</Table.Cell>
						<Table.Cell class="max-w-50 truncate font-medium">
							{debt.description || 'â€”'}
						</Table.Cell>
						<Table.Cell>
							<DebtStatusBadge status={debt.status} />
						</Table.Cell>
						<Table.Cell class="font-tabular text-right">
							{formatCurrency(debt.amount)}
						</Table.Cell>
						<Table.Cell class="text-muted-foreground tabular-nums">
							{new Date(debt.createdAt).toLocaleDateString()}
						</Table.Cell>
						<Table.Cell class="pr-6 text-right">
							<div class="flex items-center justify-end gap-1">
								<Button variant="ghost" size="sm" href={resolve(`/debts/${debt.id}`, {})}>
									<Eye class="h-4 w-4 text-muted-foreground" />
								</Button>

								{#if canDelete}
									<AlertDialog.Root
										open={dashState.deleteId === debt.id}
										onOpenChange={(open: boolean) => {
											if (!open) dashState.deleteId = '';
										}}
									>
										<AlertDialog.Trigger>
											{#snippet child({ props }: { props: Record<string, unknown> })}
												<Button
													variant="ghost"
													size="sm"
													class="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
													onclick={() => (dashState.deleteId = debt.id)}
													{...props}
												>
													<Trash2 class="h-4 w-4" />
												</Button>
											{/snippet}
										</AlertDialog.Trigger>
										<AlertDialog.Content>
											<AlertDialog.Header>
												<AlertDialog.Title>Delete Debt</AlertDialog.Title>
												<AlertDialog.Description>
													Are you sure you want to delete this debt? This action cannot be undone.
												</AlertDialog.Description>
											</AlertDialog.Header>
											<AlertDialog.Footer>
												<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
												<form
													{...deleteDebt.enhance(async ({ submit }) => {
														dashState.isDeleting = true;
														try {
															await submit();
														} finally {
															dashState.isDeleting = false;
															dashState.deleteId = '';
															invalidateAll();
														}
													})}
												>
													<input type="hidden" name="id" value={debt.id} />
													<AlertDialog.Action
														type="submit"
														class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
													>
														{dashState.isDeleting ? 'Deleting...' : 'Delete'}
													</AlertDialog.Action>
												</form>
											</AlertDialog.Footer>
										</AlertDialog.Content>
									</AlertDialog.Root>
								{/if}
							</div>
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>

		<!-- Pagination Controls -->
		{#if pagination.total > 0}
			<div class="flex flex-wrap items-center justify-between gap-3 border-t px-6 py-4">
				<div class="flex items-center gap-2 text-sm text-muted-foreground">
					<span>
						Showing {(currentPage - 1) * pageSize + 1} to {Math.min(
							currentPage * pageSize,
							pagination.total
						)} of {pagination.total} debts
					</span>
					<select
						class="ml-2 rounded border bg-background px-2 py-1 text-sm font-medium focus:ring-2 focus:ring-ring focus:outline-none"
						value={pageSize}
						onchange={(e) =>
							dashState.navigateWithParams({ pageSize: parseInt(e.currentTarget.value), page: 1 })}
					>
						<option value={5}>5 per page</option>
						<option value={10}>10 per page</option>
						<option value={25}>25 per page</option>
						<option value={50}>50 per page</option>
					</select>
				</div>
				<div class="flex items-center gap-2">
					<Button
						variant="outline"
						size="icon"
						class="h-8 w-8"
						disabled={currentPage <= 1}
						onclick={() => dashState.navigateWithParams({ page: 1 })}
					>
						<ChevronsLeft class="h-4 w-4" />
					</Button>
					<Button
						variant="outline"
						size="icon"
						class="h-8 w-8"
						disabled={currentPage <= 1}
						onclick={() => dashState.navigateWithParams({ page: currentPage - 1 })}
					>
						<ChevronLeft class="h-4 w-4" />
					</Button>
					{#each pageItems as item, index (index)}
						{#if item === 'ellipsis'}
							<span class="px-2 text-sm text-muted-foreground">...</span>
						{:else}
							<Button
								variant={item === currentPage ? 'default' : 'outline'}
								size="sm"
								class="h-8 min-w-8 px-2"
								onclick={() => dashState.navigateWithParams({ page: item })}
							>
								{item}
							</Button>
						{/if}
					{/each}
					<Button
						variant="outline"
						size="icon"
						class="h-8 w-8"
						disabled={currentPage >= totalPagesValue}
						onclick={() => dashState.navigateWithParams({ page: currentPage + 1 })}
					>
						<ChevronRight class="h-4 w-4" />
					</Button>
					<Button
						variant="outline"
						size="icon"
						class="h-8 w-8"
						disabled={currentPage >= totalPagesValue}
						onclick={() => dashState.navigateWithParams({ page: totalPagesValue })}
					>
						<ChevronsRight class="h-4 w-4" />
					</Button>
				</div>
			</div>
		{/if}
	{/if}
</Card.Root>
