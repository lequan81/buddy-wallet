<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { resolve } from '$app/paths';
	import { batchDeleteDebts, deleteDebt, deleteAllDebts } from '$lib/remotes/debts.remote';
	import { untrack } from 'svelte'; 
	import { invalidateAll, goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { toast } from 'svelte-sonner';
	import * as Card from '@repo/ui/components/ui/card';
	import { Badge } from '@repo/ui/components/ui/badge';
	import * as Table from '@repo/ui/components/ui/table';
	import { Button } from '@repo/ui/components/ui/button';
	import * as AlertDialog from '@repo/ui/components/ui/alert-dialog';
	import PageContainer from '$lib/components/layout/PageContainer.svelte';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import QuickActions from '$lib/components/dashboard/QuickActions.svelte';
	import FinancialSummary from '$lib/components/dashboard/FinancialSummary.svelte';
	import { cn } from '$lib/utils';
	import { formatCurrency } from '@repo/utils';
	import { type Debt, DEBT_STATUS } from '@repo/types';
	import DebtStatusBadge from '$lib/components/DebtStatusBadge.svelte';
	import CreateDebtModal from '$lib/components/dashboard/CreateDebtModal.svelte';
	import { createDashboardState } from './dashboard.svelte';
	
	import {
		Plus,
		Download,
		FileSpreadsheet,
		Clock,
		Users,
		FileText,
		Search,
		X,
		Filter,
		Trash2,
		CheckSquare,
		Square,
		ArrowUp,
		ArrowDown,
		ArrowUpDown,
		Eye,
		ChevronsLeft,
		ChevronLeft,
		ChevronRight,
		ChevronsRight
	} from '@repo/icons';

	let { data, form }: { data: PageData, form: ActionData } = $props();

	let createDebtModalOpen = $state(false);
	let modalInitialDescription = $state('');
	let modalInitialAmount = $state('');
	let modalInitialPhone = $state('');

	function handleOpenCreateModal(data: Record<string, string> = {}) {
		modalInitialDescription = data.description || '';
		modalInitialAmount = data.amount || '';
		modalInitialPhone = data.phone || '';
		createDebtModalOpen = true;
	}

	interface RemoteFormInstance {
		fields: {
			allIssues: () => Array<{ message: string; path?: (string | number)[] }>;
		};
		result?: {
			success?: boolean;
			deleted?: number;
		};
	}

	// Toast on form results
	$effect(() => {
		if (form && typeof form === 'object') {
			if ('error' in form && form.error) {
				const errorMessage = typeof form.error === 'string' 
					? form.error 
					: (form.error as { message?: string }).message || 'An error occurred';
				toast.error(errorMessage);
			}
			if ('success' in form && form.success) {
				const deletedCount = (form as Record<string, unknown>).deleted as number | undefined;
				toast.success(`${deletedCount || 1} debt(s) deleted successfully`);
			}
		}
	});

	// Toast for deletion redirect
	$effect(() => {
		if ($page.url.searchParams.get('deleted')) {
			toast.success('Debt deleted successfully');
			goto('/dashboard', { replaceState: true });
		}
	});

	// Toast for remote form results
	$effect(() => {
		const forms = [batchDeleteDebts, deleteDebt, deleteAllDebts] as RemoteFormInstance[];
		for (const remoteForm of forms) {
			const issues = remoteForm.fields.allIssues();
			if (issues && issues.length > 0) {
				toast.error(issues[0].message || 'An error occurred');
			}
			if (remoteForm.result?.success) {
				toast.success(`Deleted ${remoteForm.result.deleted || 1} debt(s) successfully`);
			}
		}
	});

	// Use server-computed values
	let permissions = $derived(data.permissions);
	let currentUser = $derived(data.currentUser);

	const dashState = untrack(() => createDashboardState(currentUser?.id || ''));

	// Pagination from server (URL params)
	let currentPage = $derived(data.page || 1);
	let pageSize = $derived(data.pageSize || 10);
	let statusFilter = $derived(data.statusFilter || 'all');

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

	let jumpPage = $state('');

	const clampPage = (value: number, total: number) => {
		if (!Number.isFinite(value)) return 1;
		return Math.min(Math.max(1, value), total);
	};

	const jumpToPage = (totalPagesValue: number) => {
		const target = parseInt(jumpPage, 10);
		if (!Number.isFinite(target)) return;
		jumpPage = '';
		dashState.navigateWithParams({ page: clampPage(target, totalPagesValue) });
	};
</script>

<PageContainer>
	<PageHeader title="Dashboard" description="Overview of your debts and activity">
		{#snippet actions()}
			<div class="flex flex-wrap gap-2">
				<Button onclick={() => handleOpenCreateModal()} size="sm" class="shadow-sm">
					<Plus class="mr-2 h-4 w-4" /> New Debt
				</Button>
				{#if permissions.canImportData}
					<Button variant="outline" href={resolve(`/dashboard/import`, {})} size="sm">
						<Download class="mr-2 h-4 w-4" /> Import
					</Button>
				{/if}
				{#if permissions.canExportData}
					<form method="POST" action="?/exportDebts">
						<Button type="submit" variant="outline" size="sm">
							<FileSpreadsheet class="mr-2 h-4 w-4" /> Export
						</Button>
					</form>
				{/if}
			</div>
		{/snippet}
	</PageHeader>

	<!-- Quick Actions -->
	{#await data.streamed.recentDebts then recentDebts}
		<QuickActions onOpenModal={handleOpenCreateModal} recentDebts={recentDebts} />
	{:catch}
		<QuickActions onOpenModal={handleOpenCreateModal} />
	{/await}

	<div class="space-y-6">
		<!-- Financial Summary & Stats -->
		{#await data.streamed.debtsData}
			<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				<div class="h-32 animate-pulse rounded-xl bg-muted/50"></div>
				<div class="h-32 animate-pulse rounded-xl bg-muted/50"></div>
				<div class="h-32 animate-pulse rounded-xl bg-muted/50"></div>
				<div class="h-32 animate-pulse rounded-xl bg-muted/50"></div>
			</div>

			<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				{#if permissions.canManageUsers}
					<div class="h-32 animate-pulse rounded-xl bg-muted/50"></div>
				{/if}
				<div class="h-32 animate-pulse rounded-xl bg-muted/50"></div>
				<div class="h-32 animate-pulse rounded-xl bg-muted/50"></div>
			</div>

			<div class="h-125 animate-pulse rounded-xl bg-muted/50"></div>
		{:then debtsResult}
			{@const { debts, pagination } = debtsResult as { 
				debts: Debt[]; 
				pagination: { total: number; limit: number; offset: number; hasMore: boolean } 
			}}
			{@const totalPagesValue = Math.max(1, Math.ceil(pagination.total / pageSize))}
			{@const pageItems = buildPageItems(currentPage, totalPagesValue)}
			{@const filteredDebts = debts.filter((debt) => {
				const query = dashState.debouncedSearch.trim().toLowerCase();
				if (!query) return true;
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
			})}
			{@const sortedDebts = [...filteredDebts].sort((a, b) => {
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
			})}
			{@const allSelectedOnPage =
				sortedDebts.length > 0 && sortedDebts.every((d) => dashState.selectedIds.has(d.id))}

			<!-- Financial Summary -->
			<FinancialSummary
				totalOwedToYou={debts
					.filter(
						(d: Debt) =>
							d.creditorId === currentUser?.id && d.status !== DEBT_STATUS.PAID && d.status !== DEBT_STATUS.CANCELLED
					)
					.reduce((acc: number, d: Debt) => acc + d.amount, 0)}
				totalYouOwe={debts
					.filter(
						(d: Debt) =>
							d.debtorId === currentUser?.id && d.status !== DEBT_STATUS.PAID && d.status !== DEBT_STATUS.CANCELLED
					)
					.reduce((acc: number, d: Debt) => acc + d.amount, 0)}
			/>

			<!-- Pending Confirmation Alert -->
			{@const debtsNeedingMyConfirmation = debts.filter((d: Debt) => {
				if (!d.needsConfirmation) return false;
				if (d.uploadedById === currentUser?.id) return false;
				const isCreditor = d.creditorId === currentUser?.id;
				const isDebtor = d.debtorId === currentUser?.id;
				if (isCreditor && !d.confirmedByCreditor) return true;
				if (isDebtor && !d.confirmedByDebtor) return true;
				return false;
			})}

			{#if debtsNeedingMyConfirmation.length > 0}
				<Card.Root
					class="border-warning/50 bg-warning/5"
				>
					<Card.Header>
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								<Clock class="h-5 w-5 text-warning" />
								<Card.Title class="text-lg text-warning-foreground"
									>Action Required</Card.Title
								>
							</div>
							<Badge
								variant="outline"
								class="border-warning text-warning-foreground"
							>
								{debtsNeedingMyConfirmation.length} pending
							</Badge>
						</div>
						<Card.Description class="text-yellow-800 dark:text-yellow-200">
							These debts are waiting for your confirmation
						</Card.Description>
					</Card.Header>
					<Card.Content>
						<div class="space-y-2">
							{#each debtsNeedingMyConfirmation.slice(0, 3) as debt}
								<a
									href={resolve(`/debts/${debt.id}`, {})}
									class="flex items-center justify-between rounded-lg border border-yellow-200 bg-white p-3 transition-colors hover:bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/30 dark:hover:bg-yellow-900/30"
								>
									<div class="flex-1">
										<p class="font-medium text-yellow-900 dark:text-yellow-100">
											{debt.description || 'No description'}
										</p>
										<p class="text-sm text-yellow-700 dark:text-yellow-300">
											{debt.creditorId === currentUser?.id
												? `${debt.debtorPhone} says they owe you`
												: `You owe ${debt.creditorPhone}`}
										</p>
									</div>
									<div class="text-right">
										<p class="font-tabular font-semibold text-yellow-900 dark:text-yellow-100">
											{formatCurrency(debt.amount)}
										</p>
										<p class="text-xs text-yellow-600 dark:text-yellow-400">
											{new Date(debt.createdAt).toLocaleDateString()}
										</p>
									</div>
								</a>
							{/each}
							{#if debtsNeedingMyConfirmation.length > 3}
								<Button
									variant="ghost"
									size="sm"
									class="w-full text-yellow-700 hover:bg-yellow-100 hover:text-yellow-900 dark:text-yellow-300 dark:hover:bg-yellow-900/50"
								>
									View all {debtsNeedingMyConfirmation.length} pending debts â†’
								</Button>
							{/if}
						</div>
					</Card.Content>
				</Card.Root>
			{/if}

			<!-- Stats Grid -->
			<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				{#if permissions.canManageUsers}
					{#await data.streamed.users}
						<div class="h-32 animate-pulse rounded-xl bg-muted/50"></div>
					{:then users}
						<Card.Root>
							<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
								<Card.Title class="text-sm font-medium text-muted-foreground"
									>Total Users</Card.Title
								>
								<Users class="h-4 w-4 text-muted-foreground" />
							</Card.Header>
							<Card.Content>
								<div class="font-tabular text-4xl font-bold">{users.length}</div>
								<p class="mt-1 text-xs text-muted-foreground">
									<a href={resolve(`/settings/banks`, {})} class="hover:underline">Manage users →</a>
								</p>
							</Card.Content>
						</Card.Root>
					{/await}
				{/if}

				<Card.Root>
					<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
						<Card.Title class="text-sm font-medium text-muted-foreground">Total Debts</Card.Title>
						<FileText class="h-4 w-4 text-muted-foreground" />
					</Card.Header>
					<Card.Content>
						<div class="font-tabular text-4xl font-bold">{debts.length}</div>
						<p class="mt-1 text-xs text-muted-foreground">All records</p>
					</Card.Content>
				</Card.Root>

				<Card.Root>
					<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
						<Card.Title class="text-sm font-medium text-muted-foreground">Pending</Card.Title>
						<Clock class="h-4 w-4 text-muted-foreground" />
					</Card.Header>
					<Card.Content>
						<div class="font-tabular text-4xl font-bold">
							{debts.filter((d: Debt) => d.status === DEBT_STATUS.PENDING).length}
						</div>
						<p class="mt-1 text-xs text-muted-foreground">Awaiting confirmation</p>
					</Card.Content>
				</Card.Root>
			</div>

			<!-- Debts Table -->
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
								<Search
									class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
								/>
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
												Are you sure you want to delete {dashState.selectedIds.size} debt(s)? This action cannot
												be undone.
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
												Are you sure you want to delete all your debts? This action cannot be
												undone.
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
							{statusFilter === 'all'
								? 'Create a debt to get started'
								: `No ${statusFilter} debts found`}
						</p>

						{#if statusFilter === 'all'}
							<Button onclick={() => handleOpenCreateModal()} variant="outline" size="sm" class="shadow-sm">
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
											{#if dashState.sortDirection === 'asc'}
												<ArrowUp class="h-3 w-3" />
											{:else}
												<ArrowDown class="h-3 w-3" />
											{/if}
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
											{#if dashState.sortDirection === 'asc'}
												<ArrowUp class="h-3 w-3" />
											{:else}
												<ArrowDown class="h-3 w-3" />
											{/if}
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
											{#if dashState.sortDirection === 'asc'}
												<ArrowUp class="h-3 w-3" />
											{:else}
												<ArrowDown class="h-3 w-3" />
											{/if}
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
											{#if dashState.sortDirection === 'asc'}
												<ArrowUp class="h-3 w-3" />
											{:else}
												<ArrowDown class="h-3 w-3" />
											{/if}
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
																Are you sure you want to delete this debt? This action cannot be
																undone.
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
									class="ml-2 rounded border bg-background px-2 py-1 text-sm"
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
							<div class="flex items-center gap-2">
								<span class="text-xs text-muted-foreground">Go to</span>
								<input
									type="number"
									min={1}
									max={totalPagesValue}
									placeholder={currentPage.toString()}
									class="h-8 w-16 rounded border bg-background px-2 py-1 text-xs"
									bind:value={jumpPage}
									onkeydown={(event) => {
										if (event.key === 'Enter') {
											jumpToPage(totalPagesValue);
										}
									}}
								/>
								<Button
									variant="outline"
									size="sm"
									class="h-8"
									onclick={() => jumpToPage(totalPagesValue)}
								>
									Go
								</Button>
							</div>
						</div>
					{/if}
				{/if}
			</Card.Root>
		{:catch _error}
			<div class="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
				<p>Failed to load dashboard data. Please try refreshing.</p>
			</div>
		{/await}
	</div>
</PageContainer>

<CreateDebtModal 
	bind:open={createDebtModalOpen} 
	initialDescription={modalInitialDescription}
	initialAmount={modalInitialAmount}
	initialPhone={modalInitialPhone}
	hasBankAccount={data.hasBankAccount}
	recentContacts={data.recentContacts}
/>

