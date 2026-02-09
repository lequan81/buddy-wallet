<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import {
		ArrowLeft,
		ArrowUp,
		ArrowDown,
		Calendar,
		FileText,
		Phone,
		User,
		Edit,
		Trash2,
		Check,
		X,
		AlertTriangle,
		Clock,
		QrCode,
		Upload,
		Image as ImageIcon
	} from '@lucide/svelte';
	import * as AlertDialog from '@repo/ui/components/ui/alert-dialog';
	import { Button } from '@repo/ui/components/ui/button';
	import * as Card from '@repo/ui/components/ui/card';
	import { Badge } from '@repo/ui/components/ui/badge';
	import { Label } from '@repo/ui/components/ui/label';
	import { Input } from '@repo/ui/components/ui/input';
	import PageContainer from '$lib/components/layout/PageContainer.svelte';
	import { apiFetch } from '$lib/api';
	import { cn } from '$lib/utils';

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

	// Toast on form results
	$effect(() => {
		if (form?.error) {
			toast.error(form.error);
		}
		if (form?.success && form?.message) {
			toast.success(form.message);
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
		switch (status?.toLowerCase()) {
			case 'pending':
				return 'outline';
			case 'confirmed':
				return 'secondary';
			case 'paid':
				return 'default';
			case 'disputed':
				return 'destructive';
			case 'cancelled':
				return 'outline';
			default:
				return 'outline';
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

<PageContainer maxWidth="max-w-4xl">
	<!-- Back Link -->
	<a
		href="/dashboard"
		class="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
	>
		<ArrowLeft class="h-4 w-4" />
		Back to Dashboard
	</a>

	{#if data.error || !data.debt}
		<!-- Error State -->
		<Card.Root>
			<Card.Content class="py-12 text-center">
				<div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
					<AlertTriangle class="h-8 w-8 text-destructive" />
				</div>
				<h1 class="mb-2 text-xl font-semibold">{data.error || 'Debt not found'}</h1>
				<p class="text-sm text-muted-foreground">
					The debt you're looking for doesn't exist or you don't have access to it.
				</p>
			</Card.Content>
		</Card.Root>
	{:else}
		<div class="space-y-6">
			<!-- Success/Error Messages -->
			{#if form?.error}
				<div class="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
					{form.error}
				</div>
			{/if}
			{#if form?.success && form?.message}
				<div class="rounded-lg border border-success/20 bg-success/10 p-3 text-sm text-success">
					{form.message}
				</div>
			{/if}

			<!-- Debt Header Card -->
			<Card.Root>
				<Card.Content class="pt-6">
					<div class="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
						<!-- Amount and Direction -->
						<div class="flex items-start gap-4">
							<div class={cn(
								'flex h-12 w-12 items-center justify-center rounded-full',
								data.isCreditor ? 'bg-success/10' : 'bg-destructive/10'
							)}>
								{#if data.isCreditor}
									<ArrowUp class="h-6 w-6 text-success" />
								{:else}
									<ArrowDown class="h-6 w-6 text-destructive" />
								{/if}
							</div>
							<div>
								<p class="mb-1 text-sm text-muted-foreground">
									{data.isCreditor ? 'Owed to you' : 'You owe'}
								</p>
								<h1 class={cn(
									'font-tabular text-4xl font-bold',
									data.isCreditor ? 'text-success' : 'text-destructive'
								)}>
									{formatCurrency(data.debt.amount)}
								</h1>
							</div>
						</div>

						<!-- Status Badge -->
						<Badge variant={getStatusVariant(data.debt.status)} class="capitalize">
							{data.debt.status}
						</Badge>
					</div>

					<!-- Metadata Grid -->
					<div class="mt-8 grid gap-4 sm:grid-cols-2">
						<div class="flex items-start gap-3">
							<FileText class="mt-0.5 h-4 w-4 text-muted-foreground" />
							<div class="min-w-0 flex-1">
								<p class="text-xs text-muted-foreground">Description</p>
								<p class="mt-0.5 font-medium">{data.debt.description || '—'}</p>
							</div>
						</div>

						<div class="flex items-start gap-3">
							<Phone class="mt-0.5 h-4 w-4 text-muted-foreground" />
							<div class="min-w-0 flex-1">
								<p class="text-xs text-muted-foreground">
									{data.isCreditor ? 'Debtor' : 'Creditor'}
								</p>
								<p class="mt-0.5 font-medium">
									{data.isCreditor ? data.debt.debtorPhone : data.debt.creditorPhone}
								</p>
							</div>
						</div>

						<div class="flex items-start gap-3">
							<Calendar class="mt-0.5 h-4 w-4 text-muted-foreground" />
							<div class="min-w-0 flex-1">
								<p class="text-xs text-muted-foreground">Created</p>
								<p class="mt-0.5 text-sm">{formatDate(data.debt.createdAt)}</p>
							</div>
						</div>

						<div class="flex items-start gap-3">
							<Clock class="mt-0.5 h-4 w-4 text-muted-foreground" />
							<div class="min-w-0 flex-1">
								<p class="text-xs text-muted-foreground">Last Updated</p>
								<p class="mt-0.5 text-sm">{formatDate(data.debt.updatedAt)}</p>
							</div>
						</div>
					</div>
				</Card.Content>
			</Card.Root>

			<!-- Payment Section (For Debtor) -->
			{#if data.isDebtor && data.debt.status !== 'paid' && data.debt.status !== 'cancelled'}
				<Card.Root>
					<Card.Header>
						<Card.Title class="flex items-center gap-2 text-lg">
							<QrCode class="h-5 w-5 text-muted-foreground" />
							Payment
						</Card.Title>
						<Card.Description>Scan QR code to pay, then upload proof</Card.Description>
					</Card.Header>
					<Card.Content>
						<div class="grid gap-6 md:grid-cols-2">
							<!-- QR Code -->
							<div>
								<p class="mb-3 text-sm font-medium text-muted-foreground">Step 1: Scan to Pay</p>
								{#if creditorBanks.length === 0}
									<div class="rounded-lg border border-dashed p-6 text-center">
										<p class="text-sm text-muted-foreground">
											Creditor has not added any bank accounts yet.
										</p>
										<p class="mt-1 text-xs text-muted-foreground">
											Please contact them for payment details.
										</p>
									</div>
								{:else}
									<div class="space-y-4">
										{#if creditorBanks.length > 1}
											<div class="space-y-2">
												<Label for="bankSelect" class="text-xs">Select Bank</Label>
												<select
													id="bankSelect"
													class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
													bind:value={selectedBankId}
												>
													{#each creditorBanks as bank}
														<option value={bank.id}>{bank.shortName} - {bank.accountNumber}</option>
													{/each}
												</select>
											</div>
										{/if}

										{#if selectedBank}
											<div class="rounded-lg border bg-white p-3 dark:bg-white/5">
												<img
													src={qrUrl()}
													alt="Payment QR Code"
													class="mx-auto w-full max-w-64 rounded"
												/>
												<div class="mt-3 space-y-1 text-center text-sm">
													<p class="font-semibold">{selectedBank.bankName}</p>
													<p class="font-mono text-xs">{selectedBank.accountNumber}</p>
													<p class="text-xs text-muted-foreground">{selectedBank.accountName}</p>
												</div>
											</div>
										{/if}
									</div>
								{/if}
							</div>

							<!-- Upload Proof -->
							<div>
								<p class="mb-3 text-sm font-medium text-muted-foreground">Step 2: Upload Proof</p>
								<div class="space-y-4">
									<div class="space-y-2">
										<Label for="proof" class="text-xs">Transaction Screenshot</Label>
										<Input id="proof" type="file" accept="image/*" bind:files={uploadFile} />
									</div>
									<Button
										onclick={handleUpload}
										disabled={!uploadFile || isUploading}
										class="w-full"
										size="sm"
									>
										{#if isUploading}
											Uploading...
										{:else}
											<Upload class="mr-2 h-4 w-4" />
											Upload Proof
										{/if}
									</Button>

									{#if uploadError}
										<p class="text-sm text-destructive">{uploadError}</p>
									{/if}
									{#if uploadSuccess}
										<div class="rounded-md border border-success/20 bg-success/10 p-2 text-sm text-success">
											Proof uploaded! The creditor will review it.
										</div>
									{/if}
								</div>
							</div>
						</div>
					</Card.Content>
				</Card.Root>
			{/if}

			<!-- Pending Proofs Section (For Creditor) -->
			{#if data.isCreditor && pendingProofs.length > 0}
				<Card.Root class="border-blue-200 dark:border-blue-900">
					<Card.Header>
						<Card.Title class="flex items-center gap-2 text-lg text-blue-700 dark:text-blue-400">
							<ImageIcon class="h-5 w-5" />
							Pending Payment Proofs
						</Card.Title>
						<Card.Description>Review and approve payment proofs</Card.Description>
					</Card.Header>
					<Card.Content>
						<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
							{#each pendingProofs as proof}
								<div class="overflow-hidden rounded-lg border">
									<div class="aspect-video w-full overflow-hidden bg-muted">
										<!-- svelte-ignore a11y_img_redundant_alt -->
										<img
											src={`${import.meta.env.VITE_API_URL || ''}${proof.url}`}
											alt="Proof Image"
											class="h-full w-full object-cover"
										/>
									</div>
									<div class="p-3">
										<p class="mb-3 text-xs text-muted-foreground">{formatDate(proof.createdAt)}</p>
										<div class="flex gap-2">
											<Button
												size="sm"
												class="flex-1 bg-success hover:bg-success/90"
												onclick={() => approveProof(proof.id)}
											>
												<Check class="mr-1 h-4 w-4" /> Approve
											</Button>
											<Button
												size="sm"
												variant="destructive"
												class="flex-1"
												onclick={() => rejectProof(proof.id)}
											>
												<X class="mr-1 h-4 w-4" /> Reject
											</Button>
										</div>
									</div>
								</div>
							{/each}
						</div>
					</Card.Content>
				</Card.Root>
			{/if}

			<!-- Edit Form (shown when editing) -->
			{#if isEditing && canEdit()}
				<Card.Root>
					<Card.Header>
						<Card.Title class="text-lg">Edit Debt</Card.Title>
					</Card.Header>
					<Card.Content>
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
							<div class="space-y-2">
								<Label for="description" class="text-xs">Description</Label>
								<Input
									type="text"
									id="description"
									name="description"
									bind:value={editDescription}
									placeholder="What is this debt for?"
								/>
							</div>
							<div class="space-y-2">
								<Label for="amount" class="text-xs">Amount</Label>
								<Input
									type="number"
									id="amount"
									name="amount"
									bind:value={editAmount}
									min="1"
									placeholder="Amount in VND"
								/>
							</div>
							<div class="flex gap-2">
								<Button type="submit" disabled={isSubmitting} size="sm">
									{isSubmitting ? 'Saving...' : 'Save Changes'}
								</Button>
								<Button type="button" variant="outline" size="sm" onclick={() => (isEditing = false)}>
									Cancel
								</Button>
							</div>
						</form>
					</Card.Content>
				</Card.Root>
			{/if}

			<!-- Actions Card -->
			{#if validTransitions.length > 0 || canEdit() || canDelete()}
				<Card.Root>
					<Card.Header>
						<Card.Title class="text-lg">Actions</Card.Title>
					</Card.Header>
					<Card.Content class="space-y-4">
						<!-- Status Transitions -->
						{#if validTransitions.length > 0}
							<div>
								<p class="mb-3 text-xs text-muted-foreground">Change Status</p>
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
												size="sm"
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
						{#if canEdit() || canDelete()}
							<div class="flex flex-wrap gap-2 border-t pt-4">
								{#if canEdit() && !isEditing}
									<Button variant="outline" size="sm" onclick={() => (isEditing = true)}>
										<Edit class="mr-2 h-4 w-4" />
										Edit
									</Button>
								{/if}

								{#if canDelete()}
									<AlertDialog.Root>
										<AlertDialog.Trigger>
											{#snippet child({ props }: { props: Record<string, any> })}
												<Button variant="destructive" size="sm" {...props}>
													<Trash2 class="mr-2 h-4 w-4" />
													Delete
												</Button>
											{/snippet}
										</AlertDialog.Trigger>
										<AlertDialog.Content>
											<AlertDialog.Header>
												<AlertDialog.Title>Delete Debt</AlertDialog.Title>
												<AlertDialog.Description>
													Are you sure you want to delete this debt record? This action cannot be
													undone.
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
						{/if}
					</Card.Content>
				</Card.Root>
			{/if}

			<!-- Debt ID Reference -->
			<p class="text-center text-xs text-muted-foreground">
				Debt ID: <span class="font-mono">{data.debt.id}</span>
			</p>
		</div>
	{/if}
</PageContainer>
