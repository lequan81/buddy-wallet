<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll, goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { toast } from 'svelte-sonner';
	import * as Card from '@repo/ui/components/ui/card';
	import {
		Users,
		FileText,
		Clock,
		Plus,
		Download,
		FileSpreadsheet,
		Trash2,
		Filter,
		CheckSquare,
		Square,
		Eye
	} from '@lucide/svelte';
	import { Badge } from '@repo/ui/components/ui/badge';
	import * as Table from '@repo/ui/components/ui/table';
	import { Button } from '@repo/ui/components/ui/button';
	import * as AlertDialog from '@repo/ui/components/ui/alert-dialog';
	import PageContainer from '$lib/components/layout/PageContainer.svelte';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import FinancialSummary from '$lib/components/dashboard/FinancialSummary.svelte';
	import { cn } from '$lib/utils';

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
	let users = $derived(data.users || []);
	let debts = $derived(data.debts || []);
	let permissions = $derived(data.permissions);
	let currentUser = $derived(data.currentUser);

	// Selection state
	let selectedIds = $state<Set<string>>(new Set());
	let isSubmitting = $state(false);

	// Filter state (derived from URL)
	let statusFilter = $derived(data.statusFilter || 'all');

	// Filtered debts based on status
	let filteredDebts = $derived.by(() => {
		if (!Array.isArray(debts)) return [];
		if (statusFilter === 'all') return debts;
		return debts.filter((d: { status: string }) => d.status === statusFilter);
	});

	let pendingDebts = $derived.by(() => {
		if (!Array.isArray(debts)) return [];
		return debts.filter((d: { status: string }) => d.status === 'pending');
	});

	// Financial calculations for summary
	let totalOwedToYou = $derived.by(() => {
		if (!Array.isArray(debts) || !currentUser) return 0;
		return debts
			.filter(
				(d: { creditorId?: string; status: string }) =>
					d.creditorId === currentUser.id && d.status !== 'paid' && d.status !== 'cancelled'
			)
			.reduce((acc: number, d: { amount: number }) => acc + d.amount, 0);
	});

	let totalYouOwe = $derived.by(() => {
		if (!Array.isArray(debts) || !currentUser) return 0;
		return debts
			.filter(
				(d: { debtorId?: string; status: string }) =>
					d.debtorId === currentUser.id && d.status !== 'paid' && d.status !== 'cancelled'
			)
			.reduce((acc: number, d: { amount: number }) => acc + d.amount, 0);
	});

	let totalAmount = $derived.by(() => {
		if (!Array.isArray(debts)) return 0;
		return debts.reduce((acc: number, d: { amount: number }) => acc + d.amount, 0);
	});

	// Check if a debt can be deleted by the current user
	const canDeleteDebt = (debt: {
		uploadedById?: string;
		creditorId?: string;
		debtorId?: string;
		status?: string;
	}) => {
		if (!currentUser) return false;
		// Can delete if user uploaded the debt and it's not paid
		const isUploader = debt.uploadedById === currentUser.id;
		const isPaid = debt.status === 'paid';
		return isUploader && !isPaid;
	};

	// Debts that can be deleted
	let deletableDebts = $derived.by(() => {
		return filteredDebts.filter(canDeleteDebt);
	});

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

	const toggleSelectAll = () => {
		if (selectedIds.size === deletableDebts.length && deletableDebts.length > 0) {
			selectedIds = new Set();
		} else {
			selectedIds = new Set(deletableDebts.map((d: { id: string }) => d.id));
		}
	};

	const clearSelection = () => {
		selectedIds = new Set();
	};

	// Check if all deletable items are selected
	let allSelected = $derived(
		deletableDebts.length > 0 && selectedIds.size === deletableDebts.length
	);

	// Handle filter change
	const handleFilterChange = (newStatus: string) => {
		statusFilter = newStatus;
		clearSelection();
		goto(`/dashboard${newStatus !== 'all' ? `?status=${newStatus}` : ''}`, { replaceState: true });
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
					<Plus class="mr-2 h-4 w-4" /> New Debt
				</Button>
				{#if permissions.canImportData}
					<Button variant="outline" href="/dashboard/import" size="sm">
						<Download class="mr-2 h-4 w-4" /> Import
					</Button>
				{/if}
				{#if permissions.canExportData}
					<Button variant="outline" href="/api/v1/export/debts" size="sm">
						<FileSpreadsheet class="mr-2 h-4 w-4" /> Export
					</Button>
				{/if}
			</div>
		{/snippet}
	</PageHeader>

	<div class="space-y-6">
		<!-- Financial Summary -->
		<FinancialSummary totalOwedToYou={totalOwedToYou} totalYouOwe={totalYouOwe} />

		<!-- Stats Grid -->
		<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
			{#if permissions.canManageUsers}
				<Card.Root>
					<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
						<Card.Title class="text-sm font-medium text-muted-foreground">Total Users</Card.Title>
						<Users class="h-4 w-4 text-muted-foreground" />
					</Card.Header>
					<Card.Content>
						<div class="font-tabular text-4xl font-bold">{users.length}</div>
						<p class="mt-1 text-xs text-muted-foreground">
							<a href="/dashboard/users" class="hover:underline">Manage users →</a>
						</p>
					</Card.Content>
				</Card.Root>
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
					<div class="font-tabular text-4xl font-bold">{pendingDebts.length}</div>
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
											<Trash2 class="mr-2 h-4 w-4" />
											Delete ({selectedIds.size})
										</Button>
									{/snippet}
								</AlertDialog.Trigger>
								<AlertDialog.Content>
									<AlertDialog.Header>
										<AlertDialog.Title>Delete Selected Debts</AlertDialog.Title>
										<AlertDialog.Description>
											Are you sure you want to delete {selectedIds.size} debt(s)? This action cannot be
											undone.
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
			<Card.Content class="px-0">
				{#if filteredDebts.length === 0}
					<div class="flex flex-col items-center justify-center py-12 text-center">
						<div
							class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted"
						>
							<FileText class="h-8 w-8 text-muted-foreground" />
						</div>

						<h3 class="mb-2 text-lg font-semibold">No debts found</h3>

						<p class="mb-6 max-w-sm text-sm text-muted-foreground">
							{statusFilter === 'all'
								? 'Create a debt to get started'
								: `No ${statusFilter} debts found`}
						</p>

						{#if statusFilter === 'all'}
							<Button href="/debts/create" variant="outline" size="sm">
								<Plus class="mr-2 h-4 w-4" /> New Debt
							</Button>
						{/if}
					</div>
				{:else}
					<Table.Root>
						<Table.Header>
							<Table.Row>
								<Table.Head class="w-12 pl-6">
									{#if deletableDebts.length > 0}
										<button
											class="flex items-center justify-center"
											onclick={toggleSelectAll}
											title={allSelected ? 'Deselect all' : 'Select all deletable'}
										>
											{#if allSelected}
												<CheckSquare class="h-4 w-4 text-foreground" />
											{:else}
												<Square class="h-4 w-4 text-muted-foreground" />
											{/if}
										</button>
									{/if}
								</Table.Head>
								<Table.Head>Description</Table.Head>
								<Table.Head>Status</Table.Head>
								<Table.Head class="text-right">Amount</Table.Head>
								<Table.Head>Date</Table.Head>
								<Table.Head class="pr-6 text-right">Actions</Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#each filteredDebts as debt (debt.id)}
								{@const canDelete = canDeleteDebt(debt)}
								<Table.Row class={cn(selectedIds.has(debt.id) && 'bg-muted/50')}>
									<Table.Cell class="pl-6">
										{#if canDelete}
											<button
												class="flex items-center justify-center"
												onclick={() => toggleSelect(debt.id)}
											>
												{#if selectedIds.has(debt.id)}
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
										{debt.description || '—'}
									</Table.Cell>
									<Table.Cell>
										<Badge variant={getStatusVariant(debt.status)} class="capitalize">
											{debt.status}
										</Badge>
									</Table.Cell>
									<Table.Cell class="font-tabular text-right">
										{formatCurrency(debt.amount)}
									</Table.Cell>
									<Table.Cell class="tabular-nums text-muted-foreground">
										{new Date(debt.createdAt).toLocaleDateString()}
									</Table.Cell>
									<Table.Cell class="pr-6 text-right">
										<Button variant="ghost" size="sm" href="/debts/{debt.id}">
										<Eye class="h-4 w-4" />
										</Button>
									</Table.Cell>
								</Table.Row>
							{/each}
						</Table.Body>
					</Table.Root>
				{/if}
			</Card.Content>
		</Card.Root>
	</div>
</PageContainer>
