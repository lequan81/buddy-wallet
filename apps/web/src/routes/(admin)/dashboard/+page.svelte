<script lang="ts">
	import { enhance } from '$app/forms';
	/* eslint-disable svelte/prefer-svelte-reactivity */
	import { invalidateAll, goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { toast } from 'svelte-sonner';
	import * as Card from '@repo/ui/components/ui/card';
	// import {
	// 	Users,
	// 	FileText,
	// 	Clock,
	// 	Plus,
	// 	Download,
	// 	FileSpreadsheet,
	// 	Trash2,
	// 	Filter,
	// 	CheckSquare,
	// 	Square,
	// 	Eye,
	// 	Search,
	// 	X,
	// 	ChevronLeft,
	// 	ChevronRight,
	// 	ChevronsLeft,
	// 	ChevronsRight,
	// 	ArrowUpDown,
	// 	ArrowUp,
	// 	ArrowDown
	import { Badge } from '@repo/ui/components/ui/badge';
	import * as Table from '@repo/ui/components/ui/table';
	import { Button } from '@repo/ui/components/ui/button';
	import * as AlertDialog from '@repo/ui/components/ui/alert-dialog';
	import PageContainer from '$lib/components/layout/PageContainer.svelte';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import FinancialSummary from '$lib/components/dashboard/FinancialSummary.svelte';
	import { cn } from '$lib/utils';
	import type { Debt } from '@repo/types';

	let { data, form } = $props();

	// Toast on form results
	$effect(() => {
		if (form?.error) {
			toast.error(form.error);
		}
		if (form?.success) {
			toast.success(`${form.deleted} debt(s) deleted successfully`);
		}
	});

	// Toast for deletion redirect
	$effect(() => {
		if ($page.url.searchParams.get('deleted')) {
			toast.success('Debt deleted successfully');
			goto('/dashboard', { replaceState: true });
		}
	});

	// Use server-computed values
	let permissions = $derived(data.permissions);
	let currentUser = $derived(data.currentUser);

	// Selection state
	let selectedIds = $state<Set<string>>(new Set());
	let isSubmitting = $state(false);

	// Search state
	let searchQuery = $state('');
	let debouncedSearch = $state('');

	// Pagination from server (URL params)
	let currentPage = $derived(data.page || 1);
	let pageSize = $derived(data.pageSize || 10);

	// Total pages will be calculated in the template view
	let totalPages = $state(1);

	// Helper to navigate with pagination params
	const navigateWithParams = (params: { page?: number; pageSize?: number; status?: string }) => {
		const url = new URL($page.url);
		if (params.page !== undefined) url.searchParams.set('page', params.page.toString());
		if (params.pageSize !== undefined) url.searchParams.set('pageSize', params.pageSize.toString());
		if (params.status !== undefined) {
			if (params.status === 'all') {
				url.searchParams.delete('status');
			} else {
				url.searchParams.set('status', params.status);
			}
		}
		goto(url.toString(), { invalidateAll: true });
	};

	// Sorting state
	type SortField = 'description' | 'status' | 'amount' | 'date';
	type SortDirection = 'asc' | 'desc';
	let sortField = $state<SortField>('date');
	let sortDirection = $state<SortDirection>('desc');

	const toggleSort = (field: SortField) => {
		if (sortField === field) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortField = field;
			sortDirection = 'desc';
		}
	};

	// Debounce search
	$effect(() => {
		const timeout = setTimeout(() => {
			debouncedSearch = searchQuery;
		}, 300);
		return () => clearTimeout(timeout);
	});

	// Filter state (derived from URL)
	let statusFilter = $derived(data.statusFilter || 'all');

	// Check if a debt can be deleted by the current user
	const canDeleteDebt = (debt: { uploadedById?: string; status?: string }) => {
		if (!currentUser) return false;
		// Can delete if user uploaded the debt and it's not paid
		const isUploader = debt.uploadedById === currentUser.id;
		const isPaid = debt.status === 'paid';
		return isUploader && !isPaid;
	};

	// Selection helpers
	const toggleSelect = (id: string) => {
		const newSet = new Set(selectedIds);
		if (newSet.has(id)) {
			newSet.delete(id);
		} else {
			newSet.add(id);
		}
		selectedIds = newSet;
	};

	const toggleSelectAll = (items: { id: string }[]) => {
		const allSelected = items.every((d) => selectedIds.has(d.id));

		if (allSelected) {
			// Deselect all on current page
			const newSet = new Set(selectedIds);
			for (const d of items) {
				newSet.delete(d.id);
			}
			selectedIds = newSet;
		} else {
			// Select all on current page
			const newSet = new Set(selectedIds);
			for (const d of items) {
				newSet.add(d.id);
			}
			selectedIds = newSet;
		}
	};

	const clearSelection = () => {
		selectedIds = new Set();
	};

	// Handle filter change - reset to page 1 and navigate
	const handleFilterChange = (newStatus: string) => {
		clearSelection();
		navigateWithParams({ status: newStatus, page: 1 });
	};

	// Format currency
	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat('vi-VN', {
			style: 'currency',
			currency: 'VND',
			maximumFractionDigits: 0
		}).format(amount);
	};

	// Status badge variant
	const getStatusVariant = (
		status: string
	): 'default' | 'secondary' | 'destructive' | 'outline' => {
		switch (status) {
			case 'pending':
				return 'outline';
			case 'confirmed':
				return 'secondary';
			case 'paid':
				return 'default';
			case 'disputed':
				return 'destructive';
			default:
				return 'outline';
		}
	};
</script>

<PageContainer>
	<!-- Page Header -->
	<PageHeader title="Dashboard" description="Overview of your debts and activity">
		{#snippet actions()}
			<div class="flex flex-wrap gap-2">
				<Button href="/debts/create" size="sm">
					<IconLucidePlus class="mr-2 h-4 w-4" /> New Debt
				</Button>
				{#if permissions.canImportData}
					<Button variant="outline" href="/dashboard/import" size="sm">
						<IconLucideDownload class="mr-2 h-4 w-4" /> Import
					</Button>
				{/if}
				{#if permissions.canExportData}
					<Button variant="outline" href="/api/v1/export/debts" size="sm">
						<IconLucideFileSpreadsheet class="mr-2 h-4 w-4" /> Export
					</Button>
				{/if}
			</div>
		{/snippet}
	</PageHeader>

	<div class="space-y-6">
		<!-- Financial Summary & Stats -->
		{#await data.streamed.debtsData}
			<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				<div class="h-32 animate-pulse rounded-xl bg-muted/50"></div>
				<div class="h-32 animate-pulse rounded-xl bg-muted/50"></div>
				<div class="h-32 animate-pulse rounded-xl bg-muted/50"></div>
				<div class="h-32 animate-pulse rounded-xl bg-muted/50"></div>
			</div>
		{:then debtsResult}
			{@const debts = debtsResult.debts}
			{@const pagination = debtsResult.pagination}

			<!-- Financial Summary -->
			<FinancialSummary
				totalOwedToYou={debts
					.filter(
						(d: Debt) =>
							d.creditorId === currentUser?.id && d.status !== 'paid' && d.status !== 'cancelled'
					)
					.reduce((acc: number, d: Debt) => acc + d.amount, 0)}
				totalYouOwe={debts
					.filter(
						(d: Debt) =>
							d.debtorId === currentUser?.id && d.status !== 'paid' && d.status !== 'cancelled'
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
					class="border-yellow-500 bg-yellow-50 dark:border-yellow-600 dark:bg-yellow-950/20"
				>
					<Card.Header>
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								<IconLucideClock class="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
								<Card.Title class="text-lg text-yellow-900 dark:text-yellow-100"
									>Action Required</Card.Title
								>
							</div>
							<Badge
								variant="outline"
								class="border-yellow-600 text-yellow-700 dark:border-yellow-400 dark:text-yellow-300"
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
									href="/debts/{debt.id}"
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
					<Card.Root>
						<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
							<Card.Title class="text-sm font-medium text-muted-foreground">Total Users</Card.Title>
							<IconLucideUsers class="h-4 w-4 text-muted-foreground" />
						</Card.Header>
						<Card.Content>
							{#await data.streamed.users}
								<div class="h-8 w-16 animate-pulse rounded bg-muted"></div>
							{:then users}
								<div class="font-tabular text-4xl font-bold">{users.length}</div>
							{/await}
							<p class="mt-1 text-xs text-muted-foreground">
								<a href="/admin/users" class="hover:underline">Manage users â†’</a>
							</p>
						</Card.Content>
					</Card.Root>
				{/if}

				<Card.Root>
					<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
						<Card.Title class="text-sm font-medium text-muted-foreground">Total Debts</Card.Title>
						<IconLucideFileText class="h-4 w-4 text-muted-foreground" />
					</Card.Header>
					<Card.Content>
						<div class="font-tabular text-4xl font-bold">{debts.length}</div>
						<p class="mt-1 text-xs text-muted-foreground">All records</p>
					</Card.Content>
				</Card.Root>

				<Card.Root>
					<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
						<Card.Title class="text-sm font-medium text-muted-foreground">Pending</Card.Title>
						<IconLucideClock class="h-4 w-4 text-muted-foreground" />
					</Card.Header>
					<Card.Content>
						<div class="font-tabular text-4xl font-bold">
							{debts.filter((d: Debt) => d.status === 'pending').length}
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
								<IconLucideSearch
									class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
								/>
								<input
									type="text"
									placeholder="Search debts..."
									bind:value={searchQuery}
									class="h-9 w-48 rounded-md border bg-background pr-8 pl-9 text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none"
								/>
								{#if searchQuery}
									<button
										onclick={() => (searchQuery = '')}
										class="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
									>
										<IconLucideX class="h-4 w-4" />
									</button>
								{/if}
							</div>

							<!-- Status Filter -->
							<div class="flex items-center gap-1 rounded-lg border p-1">
								<IconLucideFilter class="ml-1 h-4 w-4 text-muted-foreground" />
								{#each ['all', 'pending', 'confirmed', 'paid', 'disputed', 'cancelled'] as status}
									<button
										class={cn(
											'rounded px-2 py-1 text-xs font-medium transition-colors',
											statusFilter === status
												? 'bg-muted text-foreground'
												: 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
										)}
										onclick={() => handleFilterChange(status)}
									>
										{status.charAt(0).toUpperCase() + status.slice(1)}
									</button>
								{/each}
							</div>

							<!-- Bulk Delete Button -->
							{#if selectedIds.size > 0}
								<AlertDialog.Root>
									<AlertDialog.Trigger>
										{#snippet child({ props }: { props: Record<string, any> })}
											<Button variant="destructive" size="sm" {...props}>
												<IconLucideTrash2 class="mr-2 h-4 w-4" />
												Delete ({selectedIds.size})
											</Button>
										{/snippet}
									</AlertDialog.Trigger>
									<AlertDialog.Content>
										<AlertDialog.Header>
											<AlertDialog.Title>Delete Selected Debts</AlertDialog.Title>
											<AlertDialog.Description>
												Are you sure you want to delete {selectedIds.size} debt(s)? This action cannot
												be undone.
											</AlertDialog.Description>
										</AlertDialog.Header>
										<AlertDialog.Footer>
											<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
											<form
												method="POST"
												action="?/batchDelete"
												use:enhance={() => {
													isSubmitting = true;
													return async ({ update }) => {
														await update();
														isSubmitting = false;
														clearSelection();
														invalidateAll();
													};
												}}
											>
												<input type="hidden" name="ids" value={Array.from(selectedIds).join(',')} />
												<AlertDialog.Action
													type="submit"
													class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
												>
													{isSubmitting ? 'Deleting...' : 'Delete'}
												</AlertDialog.Action>
											</form>
										</AlertDialog.Footer>
									</AlertDialog.Content>
								</AlertDialog.Root>
							{/if}
						</div>
					</div>
				</Card.Header>
				{@const sortedDebts = [...debts].sort((a, b) => {
					let comparison = 0;
					switch (sortField) {
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
					return sortDirection === 'asc' ? comparison : -comparison;
				})}

				{@const allSelectedOnPage =
					sortedDebts.length > 0 && sortedDebts.every((d) => selectedIds.has(d.id))}

				{#if sortedDebts.length === 0}
					<div class="flex flex-col items-center justify-center py-12 text-center">
						<div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
							<IconLucideFileText class="h-8 w-8 text-muted-foreground" />
						</div>

						<h3 class="mb-2 text-lg font-semibold">No debts found</h3>

						<p class="mb-6 max-w-sm text-sm text-muted-foreground">
							{statusFilter === 'all'
								? 'Create a debt to get started'
								: `No ${statusFilter} debts found`}
						</p>

						{#if statusFilter === 'all'}
							<Button href="/debts/create" variant="outline" size="sm">
								<IconLucidePlus class="mr-2 h-4 w-4" /> New Debt
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
										onclick={() => toggleSelectAll(sortedDebts)}
										title={allSelectedOnPage ? 'Deselect all' : 'Select all deletable'}
									>
										{#if allSelectedOnPage}
											<IconLucideCheckSquare class="h-4 w-4 text-foreground" />
										{:else}
											<IconLucideSquare class="h-4 w-4 text-muted-foreground" />
										{/if}
									</button>
								</Table.Head>
								<Table.Head>
									<button
										class="flex items-center gap-1 hover:text-foreground"
										onclick={() => toggleSort('description')}
									>
										Description
										{#if sortField === 'description'}
											{#if sortDirection === 'asc'}
												<IconLucideArrowUp class="h-3 w-3" />
											{:else}
												<IconLucideArrowDown class="h-3 w-3" />
											{/if}
										{:else}
											<IconLucideArrowUpDown class="h-3 w-3 opacity-50" />
										{/if}
									</button>
								</Table.Head>
								<Table.Head>
									<button
										class="flex items-center gap-1 hover:text-foreground"
										onclick={() => toggleSort('status')}
									>
										Status
										{#if sortField === 'status'}
											{#if sortDirection === 'asc'}
												<IconLucideArrowUp class="h-3 w-3" />
											{:else}
												<IconLucideArrowDown class="h-3 w-3" />
											{/if}
										{:else}
											<IconLucideArrowUpDown class="h-3 w-3 opacity-50" />
										{/if}
									</button>
								</Table.Head>
								<Table.Head class="text-right">
									<button
										class="ml-auto flex items-center gap-1 hover:text-foreground"
										onclick={() => toggleSort('amount')}
									>
										Amount
										{#if sortField === 'amount'}
											{#if sortDirection === 'asc'}
												<IconLucideArrowUp class="h-3 w-3" />
											{:else}
												<IconLucideArrowDown class="h-3 w-3" />
											{/if}
										{:else}
											<IconLucideArrowUpDown class="h-3 w-3 opacity-50" />
										{/if}
									</button>
								</Table.Head>
								<Table.Head>
									<button
										class="flex items-center gap-1 hover:text-foreground"
										onclick={() => toggleSort('date')}
									>
										Date
										{#if sortField === 'date'}
											{#if sortDirection === 'asc'}
												<IconLucideArrowUp class="h-3 w-3" />
											{:else}
												<IconLucideArrowDown class="h-3 w-3" />
											{/if}
										{:else}
											<IconLucideArrowUpDown class="h-3 w-3 opacity-50" />
										{/if}
									</button>
								</Table.Head>
								<Table.Head class="pr-6 text-right">Actions</Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#each sortedDebts as debt (debt.id)}
								{@const canDelete = canDeleteDebt(debt)}
								<Table.Row class={cn(selectedIds.has(debt.id) && 'bg-muted/50')}>
									<Table.Cell class="pl-6">
										{#if canDelete}
											<button
												class="flex items-center justify-center"
												onclick={() => toggleSelect(debt.id)}
											>
												{#if selectedIds.has(debt.id)}
													<IconLucideCheckSquare class="h-4 w-4 text-foreground" />
												{:else}
													<IconLucideSquare class="h-4 w-4 text-muted-foreground" />
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
										<Badge variant={getStatusVariant(debt.status)} class="capitalize">
											{debt.status}
										</Badge>
									</Table.Cell>
									<Table.Cell class="font-tabular text-right">
										{formatCurrency(debt.amount)}
									</Table.Cell>
									<Table.Cell class="text-muted-foreground tabular-nums">
										{new Date(debt.createdAt).toLocaleDateString()}
									</Table.Cell>
									<Table.Cell class="pr-6 text-right">
										<Button variant="ghost" size="sm" href="/debts/{debt.id}">
											<IconLucideEye class="h-4 w-4" />
										</Button>
									</Table.Cell>
								</Table.Row>
							{/each}
						</Table.Body>
					</Table.Root>

					<!-- Pagination Controls -->
					{#if pagination.total > 0}
						<div class="flex items-center justify-between border-t px-6 py-4">
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
										navigateWithParams({ pageSize: parseInt(e.currentTarget.value), page: 1 })}
								>
									<option value={5}>5 per page</option>
									<option value={10}>10 per page</option>
									<option value={25}>25 per page</option>
									<option value={50}>50 per page</option>
								</select>
							</div>
							<div class="flex items-center gap-1">
								<Button
									variant="outline"
									size="icon"
									class="h-8 w-8"
									disabled={currentPage <= 1}
									onclick={() => navigateWithParams({ page: 1 })}
								>
									<IconLucideChevronsLeft class="h-4 w-4" />
								</Button>
								<Button
									variant="outline"
									size="icon"
									class="h-8 w-8"
									disabled={currentPage <= 1}
									onclick={() => navigateWithParams({ page: currentPage - 1 })}
								>
									<IconLucideChevronLeft class="h-4 w-4" />
								</Button>
								<span class="px-3 text-sm">
									Page {currentPage} of {totalPages}
								</span>
								<Button
									variant="outline"
									size="icon"
									class="h-8 w-8"
									disabled={currentPage >= totalPages}
									onclick={() => navigateWithParams({ page: currentPage + 1 })}
								>
									<IconLucideChevronRight class="h-4 w-4" />
								</Button>
								<Button
									variant="outline"
									size="icon"
									class="h-8 w-8"
									disabled={currentPage >= totalPages}
									onclick={() => navigateWithParams({ page: totalPages })}
								>
									<IconLucideChevronsRight class="h-4 w-4" />
								</Button>
							</div>
						</div>
					{/if}
				{/if}
			</Card.Root>
		{:catch error}
			<div class="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
				<p>Failed to load dashboard data. Please try refreshing.</p>
			</div>
		{/await}
	</div>
</PageContainer>
