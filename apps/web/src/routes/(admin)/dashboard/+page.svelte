<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll, goto } from '$app/navigation';
	import { page } from '$app/stores';
	import * as Card from '@repo/ui/components/ui/card';
	import {
		Users,
		FileText,
		Clock,
		ArrowUpRight,
		Plus,
		Download,
		FileSpreadsheet,
		Trash2,
		Filter,
		CheckSquare,
		Square,
		ExternalLink
	} from '@lucide/svelte';
	import { Separator } from '@repo/ui/components/ui/separator';
	import { Badge } from '@repo/ui/components/ui/badge';
	import * as Table from '@repo/ui/components/ui/table';
	import { Button } from '@repo/ui/components/ui/button';
	import * as AlertDialog from '@repo/ui/components/ui/alert-dialog';

	let { data, form } = $props();

	// Use server-computed values
	let users = $derived(data.users || []);
	let debts = $derived(data.debts || []);
	let permissions = $derived(data.permissions);
	let currentUser = $derived(data.currentUser);

	// Selection state
	let selectedIds = $state<Set<string>>(new Set());
	let isSubmitting = $state(false);

	// Filter state
	let statusFilter = $state(data.statusFilter || 'all');

	$effect(() => {
		statusFilter = data.statusFilter || 'all';
	});

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
		return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
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

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-3xl font-bold tracking-tight">Dashboard</h2>
			<p class="text-muted-foreground">Overview of your debts and activity.</p>
		</div>
		<div class="flex gap-2">
			<Button href="/debts/create">
				<Plus class="mr-2 h-4 w-4" /> New Debt
			</Button>
			{#if permissions.canImportData}
				<Button variant="outline" href="/dashboard/import">
					<Download class="mr-2 h-4 w-4" /> Import
				</Button>
			{/if}
			{#if permissions.canExportData}
				<a
					href="/api/v1/export/debts"
					download
					class="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium whitespace-nowrap ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
				>
					<FileSpreadsheet class="mr-2 h-4 w-4" /> Export
				</a>
			{/if}
		</div>
	</div>

	<Separator />

	<!-- Flash messages -->
	{#if form?.error}
		<div class="rounded-lg bg-red-100 p-3 text-red-700 dark:bg-red-900/30 dark:text-red-300">
			{form.error}
		</div>
	{/if}
	{#if form?.success}
		<div
			class="rounded-lg bg-green-100 p-3 text-green-700 dark:bg-green-900/30 dark:text-green-300"
		>
			{form.deleted} debt(s) deleted successfully.
		</div>
	{/if}
	{#if $page.url.searchParams.get('deleted')}
		<div
			class="rounded-lg bg-green-100 p-3 text-green-700 dark:bg-green-900/30 dark:text-green-300"
		>
			Debt deleted successfully.
		</div>
	{/if}

	<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
		{#if permissions.canManageUsers}
			<Card.Root
				class="cursor-pointer transition-colors hover:bg-muted/50"
				onclick={() => (window.location.href = '/dashboard/users')}
			>
				<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
					<Card.Title class="text-sm font-medium">Total Users</Card.Title>
					<Users class="h-4 w-4 text-muted-foreground" />
				</Card.Header>
				<Card.Content>
					<div class="text-2xl font-bold">{users.length}</div>
					<p class="text-xs text-muted-foreground">Click to manage users</p>
				</Card.Content>
			</Card.Root>
		{/if}

		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
				<Card.Title class="text-sm font-medium">Total Debts</Card.Title>
				<FileText class="h-4 w-4 text-muted-foreground" />
			</Card.Header>
			<Card.Content>
				<div class="text-2xl font-bold">{debts.length}</div>
				<p class="text-xs text-muted-foreground">All time records</p>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
				<Card.Title class="text-sm font-medium">Pending</Card.Title>
				<Clock class="h-4 w-4 text-muted-foreground" />
			</Card.Header>
			<Card.Content>
				<div class="text-2xl font-bold">{pendingDebts.length}</div>
				<p class="text-xs text-muted-foreground">Active items</p>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
				<Card.Title class="text-sm font-medium">Volume</Card.Title>
				<ArrowUpRight class="h-4 w-4 text-muted-foreground" />
			</Card.Header>
			<Card.Content>
				<div class="text-2xl font-bold">{formatCurrency(totalAmount)}</div>
				<p class="text-xs text-muted-foreground">Total value</p>
			</Card.Content>
		</Card.Root>
	</div>

	<!-- Debts Table -->
	<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
		<Card.Root class="col-span-1 md:col-span-7">
			<Card.Header>
				<div class="flex flex-wrap items-center justify-between gap-4">
					<div>
						<Card.Title>Debts</Card.Title>
						<Card.Description>
							{permissions.isAdmin ? 'All transactions in system.' : 'Your transactions.'}
						</Card.Description>
					</div>

					<!-- Filter & Bulk Actions -->
					<div class="flex flex-wrap items-center gap-2">
						<!-- Status Filter -->
						<div class="flex items-center gap-1 rounded-lg border p-1">
							<Filter class="ml-2 h-4 w-4 text-muted-foreground" />
							{#each ['all', 'pending', 'confirmed', 'paid', 'disputed', 'cancelled'] as status}
								<button
									class="rounded-md px-2 py-1 text-xs font-medium transition-colors {statusFilter ===
									status
										? 'bg-primary text-primary-foreground'
										: 'hover:bg-muted'}"
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
												class="text-destructive-foreground bg-destructive hover:bg-destructive/90"
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
			<Card.Content>
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head class="w-12">
								{#if deletableDebts.length > 0}
									<button
										class="flex items-center justify-center"
										onclick={toggleSelectAll}
										title={allSelected ? 'Deselect all' : 'Select all deletable'}
									>
										{#if allSelected}
											<CheckSquare class="h-4 w-4 text-primary" />
										{:else}
											<Square class="h-4 w-4 text-muted-foreground" />
										{/if}
									</button>
								{/if}
							</Table.Head>
							<Table.Head>Description</Table.Head>
							<Table.Head>Status</Table.Head>
							<Table.Head>Amount</Table.Head>
							<Table.Head>Date</Table.Head>
							<Table.Head class="text-right">Actions</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#if filteredDebts.length === 0}
							<Table.Row>
								<Table.Cell colspan={6} class="h-24 text-center text-muted-foreground">
									{statusFilter === 'all'
										? 'No debts found. Create one to get started!'
										: `No ${statusFilter} debts found.`}
								</Table.Cell>
							</Table.Row>
						{:else}
							{#each filteredDebts as debt (debt.id)}
								{@const canDelete = canDeleteDebt(debt)}
								<Table.Row class={selectedIds.has(debt.id) ? 'bg-muted/50' : ''}>
									<Table.Cell>
										{#if canDelete}
											<button
												class="flex items-center justify-center"
												onclick={() => toggleSelect(debt.id)}
											>
												{#if selectedIds.has(debt.id)}
													<CheckSquare class="h-4 w-4 text-primary" />
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
									<Table.Cell>{formatCurrency(debt.amount)}</Table.Cell>
									<Table.Cell class="text-muted-foreground">
										{new Date(debt.createdAt).toLocaleDateString()}
									</Table.Cell>
									<Table.Cell class="text-right">
										<Button variant="ghost" size="sm" href="/debts/{debt.id}">
											<ExternalLink class="h-4 w-4" />
										</Button>
									</Table.Cell>
								</Table.Row>
							{/each}
						{/if}
					</Table.Body>
				</Table.Root>
			</Card.Content>
		</Card.Root>
	</div>
</div>
