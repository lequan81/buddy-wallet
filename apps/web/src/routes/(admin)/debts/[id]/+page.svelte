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
		Clock,
		QrCode,
		Upload,
		Image as ImageIcon,
		Landmark
	} from '@lucide/svelte';
	import * as AlertDialog from '@repo/ui/components/ui/alert-dialog';
	import { Button } from '@repo/ui/components/ui/button';
	import * as Card from '@repo/ui/components/ui/card';
	import { Separator } from '@repo/ui/components/ui/separator';
	import { Label } from '@repo/ui/components/ui/label';
	import { Input } from '@repo/ui/components/ui/input';
	import { apiFetch } from '$lib/api';

	let { data, form } = $props<{ data: any; form: any }>();

	// Ensure arrays are defined even if data is partial
	let creditorBanks = $derived(data.creditorBanks || []);
	let pendingProofs = $derived(data.pendingProofs || []);

	// Payment/QR State
	let showPayModal = $state(false);

	let isSubmitting = $state(false);
	let isEditing = $state(false);
	let editDescription = $state('');
	let editAmount = $state('');
	let selectedBankId = $state('');
	let selectedBank = $derived(
		creditorBanks.find((b: any) => b.id === selectedBankId) ||
			creditorBanks.find((b: any) => b.isDefault) ||
			creditorBanks[0]
	);

	// Upload State
	let uploadFile: FileList | undefined = $state(undefined);
	let isUploading = $state(false);
	let uploadError = $state('');
	let uploadSuccess = $state(false);

	$effect(() => {
		editDescription = data.debt?.description || '';
		editAmount = data.debt?.amount?.toString() || '';
		if (creditorBanks.length > 0 && !selectedBankId) {
			const def = creditorBanks.find((b: any) => b.isDefault);
			if (def) selectedBankId = def.id;
			else selectedBankId = creditorBanks[0].id;
		}
	});

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

	// Generate QR URL
	const qrUrl = $derived(() => {
		if (!selectedBank || !data.debt) return '';
		const amount = data.debt.amount;
		const addInfo = `Debt ${data.debt.id}`;
		return `https://img.vietqr.io/image/${selectedBank.bankBin}-${selectedBank.accountNumber}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(addInfo)}&accountName=${encodeURIComponent(selectedBank.accountName)}`;
	});

	async function handleUpload() {
		if (!uploadFile || !uploadFile[0]) return;
		isUploading = true;
		uploadError = '';
		uploadSuccess = false;

		const formData = new FormData();
		formData.append('file', uploadFile[0]);

		const res = await apiFetch(`/upload/payment-proof/${data.debt.id}`, {
			method: 'POST',
			body: formData
			// Don't set Content-Type header, browser sets it with boundary
		});

		isUploading = false;
		if (res.error) {
			uploadError = res.error;
		} else {
			uploadSuccess = true;
			uploadFile = undefined;
			// Ideally invalidate to show it... but we don't have a "my proofs" list yet for debtor
			// Just show success msg
		}
	}

	async function approveProof(proofId: string) {
		const res = await apiFetch(`/upload/proof/${proofId}/approve`, { method: 'POST' });
		if (!res.error) {
			invalidateAll();
		}
	}

	async function rejectProof(proofId: string) {
		const reason = prompt('Enter rejection reason:');
		if (reason === null) return;

		const res = await apiFetch(`/upload/proof/${proofId}/reject`, {
			method: 'POST',
			body: JSON.stringify({ reason })
		});
		if (!res.error) {
			invalidateAll();
		}
	}
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

		<!-- Payment Section (For Debtor) -->
		{#if data.isDebtor && data.debt.status !== 'paid' && data.debt.status !== 'cancelled'}
			<div class="mb-6 rounded-xl border bg-card p-6 shadow-sm">
				<h2 class="mb-6 flex items-center gap-2 text-xl font-semibold">
					<QrCode class="h-5 w-5 text-primary" />
					Payment
				</h2>

				<div class="grid gap-8 md:grid-cols-2">
					<!-- QR Code -->
					<div>
						<h3 class="mb-4 text-sm font-medium tracking-wider text-muted-foreground uppercase">
							Step 1: Scan to Pay
						</h3>
						{#if creditorBanks.length === 0}
							<div class="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
								<p>Creditor has not added any bank accounts yet.</p>
								<p class="mt-1 text-sm">Please contact them to ask for payment details.</p>
							</div>
						{:else}
							<div class="space-y-4">
								{#if creditorBanks.length > 1}
									<div class="grid gap-2">
										<Label>Select Bank</Label>
										<select
											class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
											bind:value={selectedBankId}
										>
											{#each creditorBanks as bank}
												<option value={bank.id}>{bank.shortName} - {bank.accountNumber}</option>
											{/each}
										</select>
									</div>
								{/if}

								{#if selectedBank}
									<div
										class="flex flex-col items-center rounded-lg border bg-white p-4 dark:bg-white/10"
									>
										<img src={qrUrl()} alt="Payment QR Code" class="w-full max-w-64 rounded-lg" />
										<div class="mt-4 text-center text-sm">
											<p class="font-bold">{selectedBank.bankName}</p>
											<p class="font-mono">{selectedBank.accountNumber}</p>
											<p>{selectedBank.accountName}</p>
										</div>
									</div>
								{/if}
							</div>
						{/if}
					</div>

					<!-- Upload Proof -->
					<div>
						<h3 class="mb-4 text-sm font-medium tracking-wider text-muted-foreground uppercase">
							Step 2: Upload Proof
						</h3>
						<Card.Root>
							<div class="p-6">
								<div class="grid gap-4">
									<div class="grid gap-2">
										<Label for="proof">Transaction Screenshot</Label>
										<Input id="proof" type="file" accept="image/*" bind:files={uploadFile} />
									</div>
									<Button onclick={handleUpload} disabled={!uploadFile || isUploading}>
										{#if isUploading}
											Uploading...
										{:else}
											<Upload class="mr-2 h-4 w-4" />
											Upload Proof
										{/if}
									</Button>

									{#if uploadError}
										<p class="text-sm text-red-500">{uploadError}</p>
									{/if}
									{#if uploadSuccess}
										<div
											class="rounded-md bg-green-50 p-2 text-sm text-green-600 dark:bg-green-900/10"
										>
											Proof uploaded successfully! The creditor will review it.
										</div>
									{/if}
								</div>
							</div>
						</Card.Root>
					</div>
				</div>
			</div>
		{/if}

		<!-- Pending Proofs Section (For Creditor) -->
		{#if data.isCreditor && pendingProofs.length > 0}
			<div
				class="mb-6 rounded-xl border border-blue-200 bg-card p-6 shadow-sm dark:border-blue-900"
			>
				<h2
					class="mb-4 flex items-center gap-2 text-xl font-semibold text-blue-700 dark:text-blue-400"
				>
					<ImageIcon class="h-5 w-5" />
					Pending Payment Proofs
				</h2>

				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each pendingProofs as proof}
						<Card.Root>
							<div class="aspect-video w-full overflow-hidden rounded-t-lg bg-muted">
								<!-- svelte-ignore a11y_img_redundant_alt -->
								<img
									src={`${import.meta.env.VITE_API_URL || ''}${proof.url}`}
									alt="Proof Image"
									class="h-full w-full object-cover"
								/>
							</div>
							<div class="p-4">
								<div class="mb-4 flex items-center justify-between">
									<span class="text-xs text-muted-foreground">{formatDate(proof.createdAt)}</span>
								</div>
								<div class="flex gap-2">
									<Button
										size="sm"
										class="w-full bg-green-600 hover:bg-green-700"
										onclick={() => approveProof(proof.id)}
									>
										<Check class="mr-2 h-4 w-4" /> Approve
									</Button>
									<Button
										size="sm"
										variant="destructive"
										class="w-full"
										onclick={() => rejectProof(proof.id)}
									>
										<X class="mr-2 h-4 w-4" /> Reject
									</Button>
								</div>
							</div>
						</Card.Root>
					{/each}
				</div>
			</div>
		{/if}

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
										{@const Icon = transition.icon}
										<Icon class="mr-2 h-4 w-4" />
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
