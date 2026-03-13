<script lang="ts">
	import { AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, Calendar, Check, Clock, Edit, FileText, Image, MessageSquare, Phone, QrCode, Trash2, Upload, X } from '@repo/icons';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { Button } from '@repo/ui/components/ui/button';
	import * as Card from '@repo/ui/components/ui/card';
	import { Badge } from '@repo/ui/components/ui/badge';
	import { Label } from '@repo/ui/components/ui/label';
	import { Input } from '@repo/ui/components/ui/input';
	import { Textarea } from '@repo/ui/components/ui/textarea';
	import PageContainer from '$lib/components/layout/PageContainer.svelte';

	import { cn } from '$lib/utils';
	import { formatCurrency } from '@repo/utils';
	import DebtStatusBadge from '$lib/components/DebtStatusBadge.svelte';

	let { data, form } = $props();

	// Ensure arrays are defined even if data is partial
	let creditorBanks = $derived(data.creditorBanks || []);
	let pendingProofs = $derived(data.pendingProofs || []);

	import { createDebtDetailState } from './debt-detail.svelte';
	const state = untrack(() => createDebtDetailState(
		data.debt,
		creditorBanks,
		data.currentUser,
		data.isUploader,
		data.isCreditor,
		data.isDebtor
	));

	let debt = $derived.by(() => state.debt);

	$effect(() => {
		state.debt = data.debt;
		if (data.debt) {
			state.editDescription = data.debt.description || '';
			state.editAmount = data.debt.amount?.toString() || '';
		}
	});

	// Toast on form results and handle special responses
	$effect(() => {
		if (form?.error) {
			toast.error(form.error);
		}
		if (form?.success && form?.message) {
			toast.success(form.message);
		}
		// Handle allProofsApproved response from approveProof action
		if (form?.allProofsApproved && form?.debtId) {
			state.lastApprovedDebtId = form.debtId;
			state.showMarkAsPaidModal = true;
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
	const snapshotDebt = () => (state.debt ? { ...state.debt } : null);

	const applyDebtPatch = (patch: Record<string, unknown>) => {
		if (!state.debt) return;
		state.debt = { ...state.debt, ...patch };
	};

	const applyStatusOptimistic = (nextStatus: string) => {
		applyDebtPatch({ status: nextStatus, updatedAt: new Date().toISOString() });
	};

	const applyConfirmOptimistic = () => {
		if (!state.debt) return;
		const now = new Date().toISOString();
		const nextDebt = { ...state.debt };
		if (data.isCreditor) {
			nextDebt.confirmedByCreditor = true;
			nextDebt.creditorConfirmedAt = now;
		}
		if (data.isDebtor) {
			nextDebt.confirmedByDebtor = true;
			nextDebt.debtorConfirmedAt = now;
		}
		if (nextDebt.confirmedByCreditor && nextDebt.confirmedByDebtor) {
			nextDebt.needsConfirmation = false;
		}
		nextDebt.updatedAt = now;
		state.debt = nextDebt;
	};

	const shouldRollback = (result: { type: string }) =>
		result.type === 'failure' || result.type === 'error';
</script>

<svelte:head>
	<title>{debt ? `Debt - ${formatCurrency(debt.amount)}` : 'Debt Not Found'}</title>
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

	{#if data.error || !debt}
		<!-- Error State -->
		<Card.Root>
			<Card.Content class="py-12 text-center">
				<div
					class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10"
				>
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
				<div
					class="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
				>
					{form.error}
				</div>
			{/if}
			{#if form?.success && form?.message}
				<div class="rounded-lg border border-success/20 bg-success/10 p-3 text-sm text-success">
					{form.message}
				</div>
			{/if}

			<!-- Confirmation Banner for Counterparty -->
			{#if debt?.needsConfirmation && !data.isUploader}
				{@const needsMyConfirmation =
					(data.isCreditor && !debt.confirmedByCreditor) ||
					(data.isDebtor && !debt.confirmedByDebtor)}
				{#if needsMyConfirmation}
					<Card.Root class="border-blue-500 bg-blue-50 dark:bg-blue-950/20">
						<Card.Content
							class="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between"
						>
							<div class="flex items-center gap-3">
								<div
									class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500"
								>
									<AlertTriangle class="h-5 w-5 text-white" />
								</div>
								<div>
									<p class="font-semibold text-blue-900 dark:text-blue-100">
										Please confirm this debt
									</p>
									<p class="text-sm text-blue-700 dark:text-blue-300">
										{data.isCreditor
											? `${debt.debtorPhone} says they owe you ${formatCurrency(debt.amount)}`
											: `${debt.creditorPhone} says you owe them ${formatCurrency(debt.amount)}`}
									</p>
								</div>
							</div>
							<div class="flex gap-2">
								<form
									method="POST"
									action="?/confirmDebt"
									use:enhance={() => {
										const previousDebt = snapshotDebt();
										applyConfirmOptimistic();
										state.isSubmitting = true;
										return async ({ result, update }) => {
											await update();
											state.isSubmitting = false;
											if (shouldRollback(result) && previousDebt) {
												state.debt = previousDebt;
											}
											invalidateAll();
										};
									}}
								>
									<Button type="submit" size="sm" variant="default" disabled={state.isSubmitting}>
										<Check class="mr-2 h-4 w-4" />
										Yes, Confirm
									</Button>
								</form>
								<form
									method="POST"
									action="?/updateStatus"
									use:enhance={({ formData }) => {
										formData.set('status', 'disputed');
										const previousDebt = snapshotDebt();
										applyStatusOptimistic('disputed');
										state.isSubmitting = true;
										return async ({ result, update }) => {
											await update();
											state.isSubmitting = false;
											if (shouldRollback(result) && previousDebt) {
												state.debt = previousDebt;
											}
											invalidateAll();
										};
									}}
								>
									<Button type="submit" size="sm" variant="destructive" disabled={state.isSubmitting}>
										<X class="mr-2 h-4 w-4" />
										Dispute
									</Button>
								</form>
							</div>
						</Card.Content>
					</Card.Root>
				{/if}
			{/if}

			<!-- Waiting for Confirmation Banner (for creator) -->
			{#if data.isUploader && debt?.needsConfirmation}
				<Card.Root class="border-muted bg-muted/50">
					<Card.Content class="flex items-center gap-3 py-3">
						<Clock class="h-5 w-5 text-muted-foreground" />
						<p class="text-sm text-muted-foreground">
							Waiting for {data.isCreditor ? debt.debtorPhone : debt.creditorPhone} to confirm
							this debt.
						</p>
					</Card.Content>
				</Card.Root>
			{/if}

			<!-- Pending Edit Suggestion Banner (for creator) -->
			{#if state.hasPendingSuggestion}
				<Card.Root class="border-warning bg-warning/10">
					<Card.Content class="py-4">
						<div class="flex items-start gap-3">
							<MessageSquare class="mt-0.5 h-5 w-5 text-warning" />
							<div class="flex-1">
								<p class="font-medium text-warning">Edit Suggestion Pending</p>
								<p class="mt-1 text-sm text-muted-foreground">
									The other party has suggested changes to this debt:
								</p>
								<div class="mt-2 space-y-1 text-sm">
									{#if debt.suggestedAmount}
										<p>
											<span class="text-muted-foreground">Amount:</span>
											<span class="font-medium">{formatCurrency(debt.suggestedAmount)}</span>
											<span class="text-muted-foreground"
												>(was {formatCurrency(debt.amount)})</span
											>
										</p>
									{/if}
									{#if debt.suggestedDescription}
										<p>
											<span class="text-muted-foreground">Description:</span>
											<span class="font-medium">{debt.suggestedDescription}</span>
										</p>
									{/if}
								</div>
								<div class="mt-3 flex gap-2">
									<form
										method="POST"
										action="?/respondSuggestion"
										use:enhance={() => {
											state.isSubmitting = true;
											return async ({ update }) => {
												await update();
												state.isSubmitting = false;
												invalidateAll();
											};
										}}
									>
										<input type="hidden" name="accept" value="true" />
										<Button type="submit" size="sm" variant="default" disabled={state.isSubmitting}>
											<Check class="mr-2 h-4 w-4" />
											Accept
										</Button>
									</form>
									<form
										method="POST"
										action="?/respondSuggestion"
										use:enhance={() => {
											state.isSubmitting = true;
											return async ({ update }) => {
												await update();
												state.isSubmitting = false;
												invalidateAll();
											};
										}}
									>
										<input type="hidden" name="accept" value="false" />
										<Button type="submit" size="sm" variant="outline" disabled={state.isSubmitting}>
											<X class="mr-2 h-4 w-4" />
											Reject
										</Button>
									</form>
								</div>
							</div>
						</div>
					</Card.Content>
				</Card.Root>
			{/if}

			<!-- Debt Header Card -->
			<Card.Root>
				<Card.Content class="pt-6">
					<div class="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
						<!-- Amount and Direction -->
						<div class="flex items-start gap-4">
							<div
								class={cn(
									'flex h-12 w-12 items-center justify-center rounded-full',
									data.isCreditor ? 'bg-success/10' : 'bg-destructive/10'
								)}
							>
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
								<h1
									class={cn(
										'font-tabular text-4xl font-bold',
										data.isCreditor ? 'text-success' : 'text-destructive'
									)}
								>
									{formatCurrency(debt.amount)}
								</h1>
							</div>
						</div>

						<!-- Status Badge -->
						<div class="flex flex-col items-end gap-2">
							<DebtStatusBadge status={debt.status} />
							{#if debt.status === 'confirmed' && debt.hasPendingProof}
								<Badge
									variant="outline"
									class="border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400"
								>
									<Clock class="mr-1 h-3 w-3" />
									Proof Pending Review
								</Badge>
							{/if}
						</div>
					</div>

					<!-- Metadata Grid -->
					<div class="mt-8 grid gap-4 sm:grid-cols-2">
						<div class="flex items-start gap-3">
							<FileText class="mt-0.5 h-4 w-4 text-muted-foreground" />
							<div class="min-w-0 flex-1">
								<p class="text-xs text-muted-foreground">Description</p>
								<p class="mt-0.5 font-medium">{debt.description || '—'}</p>
							</div>
						</div>

						<div class="flex items-start gap-3">
							<Phone class="mt-0.5 h-4 w-4 text-muted-foreground" />
							<div class="min-w-0 flex-1">
								<p class="text-xs text-muted-foreground">
									{data.isCreditor ? 'Debtor' : 'Creditor'}
								</p>
								<p class="mt-0.5 font-medium">
									{data.isCreditor ? debt.debtorPhone : debt.creditorPhone}
								</p>
							</div>
						</div>

						<div class="flex items-start gap-3">
							<Calendar class="mt-0.5 h-4 w-4 text-muted-foreground" />
							<div class="min-w-0 flex-1">
								<p class="text-xs text-muted-foreground">Created</p>
								<p class="mt-0.5 text-sm">{formatDate(debt.createdAt)}</p>
							</div>
						</div>

						<div class="flex items-start gap-3">
							<Clock class="mt-0.5 h-4 w-4 text-muted-foreground" />
							<div class="min-w-0 flex-1">
								<p class="text-xs text-muted-foreground">Last Updated</p>
								<p class="mt-0.5 text-sm">{formatDate(debt.updatedAt)}</p>
							</div>
						</div>
					</div>
				</Card.Content>
			</Card.Root>

			<!-- Payment Section (For Debtor) -->
			{#if data.isDebtor && debt.status !== 'paid' && debt.status !== 'cancelled'}
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
													bind:value={state.selectedBankId}
												>
													{#each creditorBanks as bank}
														<option value={bank.id}>{bank.shortName} - {bank.accountNumber}</option>
													{/each}
												</select>
											</div>
										{/if}

										{#if state.selectedBank}
											<div class="rounded-lg border bg-white p-3 dark:bg-white/5">
												<img
													src={state.qrUrl}
													alt="Payment QR Code"
													class="mx-auto w-full max-w-64 rounded"
												/>
												<div class="mt-3 space-y-1 text-center text-sm">
													<p class="font-semibold">{state.selectedBank.bankName}</p>
													<p class="font-mono text-xs">{state.selectedBank.accountNumber}</p>
													<p class="text-xs text-muted-foreground">{state.selectedBank.accountName}</p>
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
										<Input id="proof" type="file" accept="image/*" bind:files={state.uploadFile} />
									</div>
									<Button
										onclick={state.handleUpload}
										disabled={!state.uploadFile || state.isUploading}
										class="w-full"
										size="sm"
									>
										{#if state.isUploading}
											Uploading...
										{:else}
											<Upload class="mr-2 h-4 w-4" />
											Upload Proof
										{/if}
									</Button>

									{#if state.uploadError}
										<p class="text-sm text-destructive">{state.uploadError}</p>
									{/if}
									{#if state.uploadSuccess}
										<div
											class="rounded-md border border-success/20 bg-success/10 p-2 text-sm text-success"
										>
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
							<Image class="h-5 w-5" />
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
											<form
												method="POST"
												action="?/approveProof"
												class="flex-1"
												use:enhance={() => {
													state.isSubmitting = true;
													return async ({ update }) => {
														await update();
														state.isSubmitting = false;
														invalidateAll();
													};
												}}
											>
												<input type="hidden" name="proofId" value={proof.id} />
												<Button
													type="submit"
													size="sm"
													class="w-full bg-success hover:bg-success/90"
													disabled={state.isSubmitting}
												>
													<Check class="mr-1 h-4 w-4" /> Approve
												</Button>
											</form>
											<form
												method="POST"
												action="?/rejectProof"
												class="flex-1"
												use:enhance={({ formData, cancel }) => {
													const reason = prompt('Enter rejection reason:');
													if (reason === null) {
														cancel();
														return;
													}
													formData.set('reason', reason);
													state.isSubmitting = true;
													return async ({ update }) => {
														await update();
														state.isSubmitting = false;
														invalidateAll();
													};
												}}
											>
												<input type="hidden" name="proofId" value={proof.id} />
												<Button
													type="submit"
													size="sm"
													variant="destructive"
													class="w-full"
													disabled={state.isSubmitting}
												>
													<X class="mr-1 h-4 w-4" /> Reject
												</Button>
											</form>
										</div>
									</div>
								</div>
							{/each}
						</div>
					</Card.Content>
				</Card.Root>
			{/if}

			<!-- Edit Form (shown when editing) -->
			{#if state.isEditing && state.canEdit}
				<Card.Root>
					<Card.Header>
						<Card.Title class="text-lg">Edit Debt</Card.Title>
					</Card.Header>
					<Card.Content>
						<form
							method="POST"
							action="?/update"
							use:enhance={() => {
								const previousDebt = snapshotDebt();
								const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
								if (state.editDescription) patch.description = state.editDescription;
								if (state.editAmount) patch.amount = Number(state.editAmount);
								applyDebtPatch(patch);
								state.isSubmitting = true;
								return async ({ result, update }) => {
									await update();
									state.isSubmitting = false;
									state.isEditing = false;
									if (shouldRollback(result) && previousDebt) {
										state.debt = previousDebt;
									}
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
									bind:value={state.editDescription}
									placeholder="What is this debt for?"
								/>
							</div>
							<div class="space-y-2">
								<Label for="amount" class="text-xs">Amount</Label>
								<Input
									type="number"
									id="amount"
									name="amount"
									bind:value={state.editAmount}
									min="1000"
									step="1000"
									placeholder="Amount in VND"
								/>
							</div>
							<div class="flex gap-2">
								<Button type="submit" disabled={state.isSubmitting} size="sm">
									{state.isSubmitting ? 'Saving...' : 'Save Changes'}
								</Button>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onclick={() => (state.isEditing = false)}
								>
									Cancel
								</Button>
							</div>
						</form>
					</Card.Content>
				</Card.Root>
			{/if}

			<!-- Actions Card -->
			{#if state.validTransitions.length > 0 || state.canEdit || state.canDelete || state.canSuggestEdit}
				<Card.Root>
					<Card.Header>
						<Card.Title class="text-lg">Actions</Card.Title>
					</Card.Header>
					<Card.Content class="space-y-4">
						<!-- Status Transitions -->
						{#if state.validTransitions.length > 0}
							<div>
								<p class="mb-3 text-xs text-muted-foreground">Change Status</p>
								<div class="flex flex-wrap gap-2">
									{#each state.validTransitions as transition}
										<form
											method="POST"
											action="?/updateStatus"
											use:enhance={() => {
												const previousDebt = snapshotDebt();
												applyStatusOptimistic(transition.status);
												state.isSubmitting = true;
												return async ({ result, update }) => {
													await update();
													state.isSubmitting = false;
													if (shouldRollback(result) && previousDebt) {
														state.debt = previousDebt;
													}
													invalidateAll();
												};
											}}
										>
											<input type="hidden" name="status" value={transition.status} />
											<Button
												type="submit"
												disabled={state.isSubmitting || transition.disabled}
												size="sm"
												variant={transition.status === 'cancelled' ||
												transition.status === 'disputed'
													? 'destructive'
													: 'default'}
												title={transition.disabled ? 'Upload proof of payment first' : ''}
											>
												{#if transition.icon === 'Check'}
													<Check class="mr-2 h-4 w-4" />
												{:else if transition.icon === 'AlertTriangle'}
													<AlertTriangle class="mr-2 h-4 w-4" />
												{:else if transition.icon === 'X'}
													<X class="mr-2 h-4 w-4" />
												{/if}
												{transition.label}
											</Button>
										</form>
									{/each}
								</div>
							</div>
						{/if}

						<!-- Edit & Delete -->
						{#if state.canEdit || state.canDelete}
							<div class="flex flex-wrap gap-2 border-t pt-4">
								{#if state.canEdit && !state.isEditing}
									<Button variant="outline" size="sm" onclick={() => (state.isEditing = true)}>
										<Edit class="mr-2 h-4 w-4" />
										Edit
									</Button>
								{/if}

								{#if state.canDelete}
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
														state.isSubmitting = true;
														return async ({ update }) => {
															await update();
															state.isSubmitting = false;
														};
													}}
												>
													<AlertDialog.Action
														type="submit"
														class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
													>
														{state.isSubmitting ? 'Deleting...' : 'Delete'}
													</AlertDialog.Action>
												</form>
											</AlertDialog.Footer>
										</AlertDialog.Content>
									</AlertDialog.Root>
								{/if}
							</div>
						{/if}

						<!-- Suggest Edit (for counterparty, not creator) -->
						{#if state.canSuggestEdit && !debt.suggestedById}
							<div class="border-t pt-4">
								<Button
									variant="outline"
									size="sm"
									onclick={() => {
										state.suggestAmount = debt.amount?.toString() || '';
										state.suggestDescription = debt.description || '';
										state.showSuggestModal = true;
									}}
								>
									<MessageSquare class="mr-2 h-4 w-4" />
									Suggest Edit
								</Button>
								<p class="mt-2 text-xs text-muted-foreground">
									Propose changes to the creator of this debt
								</p>
							</div>
						{/if}

						<!-- Waiting for suggestion response -->
						{#if state.canSuggestEdit && debt.suggestedById === data.currentUser?.id}
							<div class="border-t pt-4">
								<div class="flex items-center gap-2 text-muted-foreground">
									<Clock class="h-4 w-4" />
									<p class="text-sm">Your edit suggestion is pending review</p>
								</div>
							</div>
						{/if}
					</Card.Content>
				</Card.Root>
			{/if}

			<!-- Debt ID Reference -->
			<p class="text-center text-xs text-muted-foreground">
				Debt ID: <span class="font-mono">{debt.id}</span>
			</p>
		</div>
	{/if}

	<!-- Mark as Paid Modal -->
	<AlertDialog.Root bind:open={state.showMarkAsPaidModal}>
		<AlertDialog.Content>
			<AlertDialog.Header>
				<AlertDialog.Title>Mark Debt as Paid?</AlertDialog.Title>
				<AlertDialog.Description>
					All payment proofs have been approved. Would you like to mark this debt as fully paid?
				</AlertDialog.Description>
			</AlertDialog.Header>
			<AlertDialog.Footer>
				<AlertDialog.Cancel onclick={() => (state.showMarkAsPaidModal = false)}>
					Not Yet
				</AlertDialog.Cancel>
				<form
					method="POST"
					action="?/updateStatus"
					use:enhance={() => {
						const previousDebt = snapshotDebt();
						applyStatusOptimistic('paid');
						return async ({ result, update }) => {
							await update();
							state.showMarkAsPaidModal = false;
							if (shouldRollback(result) && previousDebt) {
								state.debt = previousDebt;
							}
							invalidateAll();
						};
					}}
				>
					<input type="hidden" name="status" value="paid" />
					<AlertDialog.Action type="submit" class="bg-success hover:bg-success/90">
						<Check class="mr-2 h-4 w-4" />
						Yes, Mark as Paid
					</AlertDialog.Action>
				</form>
			</AlertDialog.Footer>
		</AlertDialog.Content>
	</AlertDialog.Root>

	<!-- Suggest Edit Modal -->
	<AlertDialog.Root bind:open={state.showSuggestModal}>
		<AlertDialog.Content>
			<AlertDialog.Header>
				<AlertDialog.Title>Suggest Edit</AlertDialog.Title>
				<AlertDialog.Description>
					Propose changes to this debt. The creator will be notified and can accept or reject your
					suggestion.
				</AlertDialog.Description>
			</AlertDialog.Header>
			<form
				method="POST"
				action="?/suggestEdit"
				use:enhance={() => {
					state.isSuggesting = true;
					return async ({ result, update }) => {
						state.isSuggesting = false;
						if (result.type === 'success') {
							state.showSuggestModal = false;
							state.suggestAmount = '';
							state.suggestDescription = '';
						}
						await update();
						invalidateAll();
					};
				}}
			>
				<div class="grid gap-4 py-4">
					<div class="grid gap-2">
						<Label for="suggest-amount">Suggested Amount (VND)</Label>
						<Input
							id="suggest-amount"
							name="amount"
							type="number"
							placeholder={debt?.amount?.toString()}
							bind:value={state.suggestAmount}
						/>
						<p class="text-xs text-muted-foreground">
							Current: {formatCurrency(debt?.amount || 0)}
						</p>
					</div>
					<div class="grid gap-2">
						<Label for="suggest-description">Suggested Description</Label>
						<Textarea
							id="suggest-description"
							name="description"
							placeholder={debt?.description || 'Enter description'}
							bind:value={state.suggestDescription}
							rows={3}
						/>
						{#if debt?.description}
							<p class="text-xs text-muted-foreground">
								Current: {debt.description}
							</p>
						{/if}
					</div>
				</div>
				<AlertDialog.Footer>
					<AlertDialog.Cancel onclick={() => (state.showSuggestModal = false)}>Cancel</AlertDialog.Cancel>
					<Button type="submit" disabled={state.isSuggesting}>
						{#if state.isSuggesting}
							Sending...
						{:else}
							<MessageSquare class="mr-2 h-4 w-4" />
							Send Suggestion
						{/if}
					</Button>
				</AlertDialog.Footer>
			</form>
		</AlertDialog.Content>
	</AlertDialog.Root>
</PageContainer>

