<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import {
		ArrowLeft,
		DollarSign,
		Calendar,
		FileText,
		Phone,
		User,
		TrendingUp,
		TrendingDown,
		Edit,
		Trash2,
		Check,
		X,
		AlertTriangle,
		Clock
	} from '@lucide/svelte';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { Button } from '$lib/components/ui/button';

	let { data, form } = $props();

	let isSubmitting = $state(false);
	let isEditing = $state(false);
	let editDescription = $state(data.debt?.description || '');
	let editAmount = $state(data.debt?.amount?.toString() || '');

	const formatDate = (date: string | null) => {
		if (!date) return '—';
		return new Date(date).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	};

	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
	};

	// Status badge styling
	const getStatusStyle = (status: string) => {
		switch (status?.toLowerCase()) {
			case 'pending':
				return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';
			case 'confirmed':
				return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
			case 'paid':
				return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
			case 'disputed':
				return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
			case 'cancelled':
				return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300';
			default:
				return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300';
		}
	};

	// Get valid status transitions based on current status
	const getValidTransitions = (
		status: string
	): { status: string; label: string; icon: typeof Check }[] => {
		const transitions: Record<string, { status: string; label: string; icon: typeof Check }[]> = {
			pending: [
				{ status: 'confirmed', label: 'Confirm', icon: Check },
				{ status: 'disputed', label: 'Dispute', icon: AlertTriangle },
				{ status: 'cancelled', label: 'Cancel', icon: X }
			],
			confirmed: [
				{ status: 'paid', label: 'Mark as Paid', icon: Check },
				{ status: 'disputed', label: 'Dispute', icon: AlertTriangle }
			],
			disputed: [],
			paid: [],
			cancelled: []
		};
		return transitions[status?.toLowerCase()] || [];
	};

	// Check if debt can be edited
	const canEdit = $derived(() => {
		if (!data.debt || !data.isUploader) return false;
		const status = data.debt.status?.toLowerCase();
		return status === 'pending';
	});

	// Check if debt can be deleted
	const canDelete = $derived(() => {
		if (!data.debt || !data.isUploader) return false;
		const status = data.debt.status?.toLowerCase();
		return status !== 'paid';
	});

	const validTransitions = $derived(getValidTransitions(data.debt?.status || ''));
</script>

<svelte:head>
	<title>{data.debt ? `Debt - ${formatCurrency(data.debt.amount)}` : 'Debt Not Found'}</title>
</svelte:head>

<div class="container mx-auto max-w-4xl px-4 py-8">
	<!-- Back Link -->
	<a
		href="/dashboard"
		class="mb-6 inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
	>
		<ArrowLeft class="h-4 w-4" />
		Back to Dashboard
	</a>

	{#if data.error || !data.debt}
		<!-- Error State -->
		<div class="rounded-xl border bg-card p-8 text-center shadow-sm">
			<div
				class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30"
			>
				<AlertTriangle class="h-8 w-8 text-red-600" />
			</div>
			<h1 class="mb-2 text-xl font-semibold">{data.error || 'Debt not found'}</h1>
			<p class="text-muted-foreground">
				The debt you're looking for doesn't exist or you don't have access to it.
			</p>
		</div>
	{:else}
		<!-- Success/Error Messages -->
		{#if form?.error}
			<div class="mb-4 rounded-lg bg-red-100 p-3 text-red-700 dark:bg-red-900/30 dark:text-red-300">
				{form.error}
			</div>
		{/if}
		{#if form?.success && form?.message}
			<div
				class="mb-4 rounded-lg bg-green-100 p-3 text-green-700 dark:bg-green-900/30 dark:text-green-300"
			>
				{form.message}
			</div>
		{/if}

		<!-- Debt Header Card -->
		<div class="mb-6 rounded-xl border bg-card p-6 shadow-sm">
			<div class="mb-4 flex flex-wrap items-start justify-between gap-4">
				<div class="flex items-center gap-4">
					<div
						class="flex h-16 w-16 items-center justify-center rounded-full {data.isCreditor
							? 'bg-green-100 dark:bg-green-900/30'
							: 'bg-red-100 dark:bg-red-900/30'}"
					>
						{#if data.isCreditor}
							<TrendingUp class="h-8 w-8 text-green-600" />
						{:else}
							<TrendingDown class="h-8 w-8 text-red-600" />
						{/if}
					</div>
					<div>
						<p class="mb-1 text-sm text-muted-foreground">
							{data.isCreditor ? 'You are owed' : 'You owe'}
						</p>
						<h1 class="text-3xl font-bold {data.isCreditor ? 'text-green-600' : 'text-red-600'}">
							{formatCurrency(data.debt.amount)}
						</h1>
					</div>
				</div>

				<span
					class="rounded-full px-3 py-1.5 text-sm font-medium {getStatusStyle(data.debt.status)}"
				>
					{data.debt.status?.toUpperCase()}
				</span>
			</div>

			<!-- Debt Details -->
			<div class="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
				<div class="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
					<FileText class="h-5 w-5 text-muted-foreground" />
					<div>
						<p class="text-xs text-muted-foreground">Description</p>
						<p class="font-medium">{data.debt.description || '—'}</p>
					</div>
				</div>

				<div class="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
					<Phone class="h-5 w-5 text-muted-foreground" />
					<div>
						<p class="text-xs text-muted-foreground">
							{data.isCreditor ? 'Debtor' : 'Creditor'}
						</p>
						<p class="font-medium">
							{data.isCreditor ? data.debt.debtorPhone : data.debt.creditorPhone}
						</p>
					</div>
				</div>

				<div class="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
					<Calendar class="h-5 w-5 text-muted-foreground" />
					<div>
						<p class="text-xs text-muted-foreground">Created</p>
						<p class="font-medium">{formatDate(data.debt.createdAt)}</p>
					</div>
				</div>

				<div class="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
					<Clock class="h-5 w-5 text-muted-foreground" />
					<div>
						<p class="text-xs text-muted-foreground">Last Updated</p>
						<p class="font-medium">{formatDate(data.debt.updatedAt)}</p>
					</div>
				</div>
			</div>
		</div>

		<!-- Edit Form (shown when editing) -->
		{#if isEditing && canEdit()}
			<div class="mb-6 rounded-xl border bg-card p-6 shadow-sm">
				<h2 class="mb-4 text-lg font-semibold">Edit Debt</h2>
				<form
					method="POST"
					action="?/update"
					use:enhance={() => {
						isSubmitting = true;
						return async ({ update }) => {
							await update();
							isSubmitting = false;
							isEditing = false;
							invalidateAll();
						};
					}}
					class="space-y-4"
				>
					<div>
						<label for="description" class="mb-1 block text-sm font-medium">Description</label>
						<input
							type="text"
							id="description"
							name="description"
							bind:value={editDescription}
							class="w-full rounded-lg border bg-background px-3 py-2"
							placeholder="What is this debt for?"
						/>
					</div>
					<div>
						<label for="amount" class="mb-1 block text-sm font-medium">Amount</label>
						<input
							type="number"
							id="amount"
							name="amount"
							bind:value={editAmount}
							class="w-full rounded-lg border bg-background px-3 py-2"
							min="1"
							placeholder="Amount in VND"
						/>
					</div>
					<div class="flex gap-2">
						<Button type="submit" disabled={isSubmitting}>
							{isSubmitting ? 'Saving...' : 'Save Changes'}
						</Button>
						<Button type="button" variant="outline" onclick={() => (isEditing = false)}>
							Cancel
						</Button>
					</div>
				</form>
			</div>
		{/if}

		<!-- Actions Card -->
		{#if validTransitions.length > 0 || canEdit() || canDelete()}
			<div class="mb-6 rounded-xl border bg-card p-6 shadow-sm">
				<h2 class="mb-4 text-lg font-semibold">Actions</h2>

				<!-- Status Transitions -->
				{#if validTransitions.length > 0}
					<div class="mb-4">
						<p class="mb-3 text-sm text-muted-foreground">Change Status</p>
						<div class="flex flex-wrap gap-2">
							{#each validTransitions as transition}
								<form
									method="POST"
									action="?/updateStatus"
									use:enhance={() => {
										isSubmitting = true;
										return async ({ update }) => {
											await update();
											isSubmitting = false;
											invalidateAll();
										};
									}}
								>
									<input type="hidden" name="status" value={transition.status} />
									<Button
										type="submit"
										disabled={isSubmitting}
										variant={transition.status === 'cancelled' || transition.status === 'disputed'
											? 'destructive'
											: 'default'}
									>
										<svelte:component this={transition.icon} class="mr-2 h-4 w-4" />
										{transition.label}
									</Button>
								</form>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Edit & Delete -->
				<div class="flex flex-wrap gap-2 border-t pt-4">
					{#if canEdit() && !isEditing}
						<Button variant="outline" onclick={() => (isEditing = true)}>
							<Edit class="mr-2 h-4 w-4" />
							Edit
						</Button>
					{/if}

					{#if canDelete()}
						<AlertDialog.Root>
							<AlertDialog.Trigger>
								{#snippet child({ props })}
									<Button variant="destructive" {...props}>
										<Trash2 class="mr-2 h-4 w-4" />
										Delete
									</Button>
								{/snippet}
							</AlertDialog.Trigger>
							<AlertDialog.Content>
								<AlertDialog.Header>
									<AlertDialog.Title>Delete Debt</AlertDialog.Title>
									<AlertDialog.Description>
										Are you sure you want to delete this debt record? This action cannot be undone.
									</AlertDialog.Description>
								</AlertDialog.Header>
								<AlertDialog.Footer>
									<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
									<form
										method="POST"
										action="?/delete"
										use:enhance={() => {
											isSubmitting = true;
											return async ({ update }) => {
												await update();
												isSubmitting = false;
											};
										}}
									>
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
		{/if}

		<!-- Debt ID (for reference) -->
		<p class="text-center text-xs text-muted-foreground">
			Debt ID: {data.debt.id}
		</p>
	{/if}
</div>
