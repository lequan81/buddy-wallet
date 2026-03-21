<script lang="ts">
	import { resolve } from '$app/paths';
	import { invalidateAll } from '$app/navigation';
	import { type PageData, type ActionData } from './$types';
	import { 
		AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, Calendar, Check, Clock, Edit, FileText, Image, 
		MessageSquare, Phone, QrCode, Trash2, Upload, X 
	} from '@repo/icons';
	import { 
		updateDebtStatus, updateDebt, deleteDebt, confirmDebt, approveProof, rejectProof, 
		suggestEdit, respondSuggestion 
	} from '$lib/remotes/debts.remote';
	import { DebtDetailState } from './debt-detail.svelte';
	import PageContainer from '$lib/components/layout/PageContainer.svelte';
	import { formatCurrency, formatDate } from '@repo/utils';
	import * as Card from '@repo/ui/components/ui/card';
	import { Button } from '@repo/ui/components/ui/button';
	import * as AlertDialog from '@repo/ui/components/ui/alert-dialog';
	import { Input } from '@repo/ui/components/ui/input';
	import { Label } from '@repo/ui/components/ui/label';
	import { Textarea } from '@repo/ui/components/ui/textarea';
	import { Badge } from '@repo/ui/components/ui/badge';
	import DebtStatusBadge from '$lib/components/DebtStatusBadge.svelte';
	import { cn } from '$lib/utils';
	import { toast } from 'svelte-sonner';
	import { type DebtDetails, DEBT_STATUS } from '@repo/types';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();
	let debt = $derived(data.debt as DebtDetails | null);
	let creditorBanks = $derived(data.creditorBanks || []);
	let pendingProofs = $derived(data.pendingProofs || []);
	
	const state = $derived(debt ? new DebtDetailState(
		debt as DebtDetails,
		data.creditorBanks || [],
		data.currentUser as any,
		data.currentUser?.id === debt.creditorId,
		data.currentUser?.id === debt.creditorId,
		data.currentUser?.id === debt.debtorId
	) : null);

	$effect(() => {
		if (data.debt && state) {
			state.debt = data.debt;
			state.editDescription = data.debt.description || '';
			state.editAmount = data.debt.amount?.toString() || '';
		}
	});

	$effect(() => {
		if (form && state) {
			if ('error' in form && form.error) {
				const errorMessage = typeof form.error === 'string' 
					? form.error 
					: (form.error as any).message || 'An error occurred';
				toast.error(errorMessage);
			}
			if ('success' in form && form.success) {
				const successForm = form as any;
				if (successForm.message) toast.success(successForm.message);
				
				if (successForm.allProofsApproved && successForm.debtId) {
					state.lastApprovedDebtId = successForm.debtId;
					state.showMarkAsPaidModal = true;
				}
			}
		}
	});

	function snapshotDebt() {
		return debt ? { ...debt } : null;
	}

	function applyStatusOptimistic(status: string) {
		if (state && debt) {
			state.debt = { ...debt, status, updatedAt: new Date().toISOString() };
		}
	}

	function applyConfirmOptimistic() {
		if (state && debt) {
			const isCreditor = data.currentUser?.id === debt.creditorId;
			const now = new Date().toISOString();
			const nextDebt = { ...debt };

			if (isCreditor) {
				nextDebt.confirmedByCreditor = true;
				nextDebt.creditorConfirmedAt = now;
			} else {
				nextDebt.confirmedByDebtor = true;
				nextDebt.debtorConfirmedAt = now;
			}

			if (nextDebt.confirmedByCreditor && nextDebt.confirmedByDebtor) {
				nextDebt.needsConfirmation = false;
				nextDebt.status = DEBT_STATUS.CONFIRMED;
			}
			nextDebt.updatedAt = now;
			state.debt = nextDebt;
		}
	}

	function applyDebtPatch(patch: Partial<DebtDetails>) {
		if (state && debt) {
			state.debt = { ...debt, ...patch };
		}
	}
</script>

<svelte:head>
	<title>{debt ? `Debt - ${formatCurrency(debt.amount)}` : 'Debt Not Found'}</title>
</svelte:head>

<PageContainer maxWidth="max-w-4xl">
	<!-- Back Link -->
	<a
		href={resolve(`/dashboard`, {})}
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
			{#if state && form && typeof form === 'object'}
		{#if 'error' in form && form.error}
			<div class="mb-4 rounded-md bg-destructive/15 p-3 text-sm text-destructive">
				{(form.error as any).message || 'An error occurred'}
			</div>
		{/if}

		{#if 'success' in form && (form as any).message}
			<div class="mb-4 rounded-md bg-success/15 p-3 text-sm text-success">
				{(form as any).message}
			</div>
		{/if}
	{/if}

			<!-- Confirmation Banner for Counterparty -->
			{#if debt?.needsConfirmation && !data.isUploader}
				{@const needsMyConfirmation =
					(data.isCreditor && !debt?.confirmedByCreditor) ||
					(data.isDebtor && !debt?.confirmedByDebtor)}
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
									{...confirmDebt.enhance(async ({ submit }) => {
										const previousDebt = snapshotDebt();
										applyConfirmOptimistic();
										if (state) state.isSubmitting = true;
										try {
											await submit();
										} finally {
											if (state) state.isSubmitting = false;
											if (previousDebt && state) {
												state.debt = previousDebt;
											}
											invalidateAll();
										}
									})}
								>
									<Button type="submit" size="sm" variant="default" disabled={state?.isSubmitting}>
										<Check class="mr-2 h-4 w-4" />
										Yes, Confirm
									</Button>
								</form>
								<form
									{...updateDebtStatus.enhance(async ({ data: formData, submit }) => {
										formData.status = DEBT_STATUS.DISPUTED;
										const previousDebt = snapshotDebt();
										applyStatusOptimistic(DEBT_STATUS.DISPUTED);
										if (state) state.isSubmitting = true;
										try {
											await submit();
										} finally {
											if (state) state.isSubmitting = false;
											if (previousDebt && state) {
												state.debt = previousDebt;
											}
											invalidateAll();
										}
									})}
								>
									<Button type="submit" size="sm" variant="destructive" disabled={state?.isSubmitting}>
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
			{#if state?.hasPendingSuggestion}
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
									{#if debt?.suggestedAmount}
										<p>
											<span class="text-muted-foreground">Amount:</span>
											<span class="font-medium">{formatCurrency(debt.suggestedAmount)}</span>
											<span class="text-muted-foreground"
												>(was {formatCurrency(debt.amount)})</span
											>
										</p>
									{/if}
									{#if debt?.suggestedDescription}
										<p>
											<span class="text-muted-foreground">Description:</span>
											<span class="font-medium">{debt.suggestedDescription}</span>
										</p>
									{/if}
								</div>
								<div class="mt-3 flex gap-2">
									<form
										{...respondSuggestion.enhance(async ({ data: formData, submit }) => {
											formData.accept = 'true';
											if (state) state.isSubmitting = true;
											try {
												await submit();
											} finally {
												if (state) state.isSubmitting = false;
												invalidateAll();
											}
										})}
									>
										<Button type="submit" size="sm" variant="default" disabled={state?.isSubmitting}>
											<Check class="mr-2 h-4 w-4" />
											Accept
										</Button>
									</form>
									<form
										{...respondSuggestion.enhance(async ({ data: formData, submit }) => {
											formData.accept = 'false';
											if (state) state.isSubmitting = true;
											try {
												await submit();
											} finally {
												if (state) state.isSubmitting = false;
												invalidateAll();
											}
										})}
									>
										<Button type="submit" size="sm" variant="outline" disabled={state?.isSubmitting}>
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
							{#if debt.status === DEBT_STATUS.CONFIRMED && debt?.hasPendingProof}
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
								<p class="mt-0.5 text-sm">{formatDate(debt?.updatedAt)}</p>
							</div>
						</div>
					</div>
				</Card.Content>
			</Card.Root>

			<!-- Payment Section (For Debtor) -->
			{#if data.isDebtor && debt.status !== DEBT_STATUS.PAID && debt.status !== DEBT_STATUS.CANCELLED}
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
								{#if state}
									{@const s = state}
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
														bind:value={s.selectedBankId}
													>
														{#each creditorBanks as bank}
															<option value={bank.id}>{(bank as any).shortName || (bank as any).bankCode || 'Bank'} - {bank.accountNumber}</option>
														{/each}
													</select>
												</div>
											{/if}

											{#if s.selectedBank}
												<div class="rounded-lg border bg-white p-3 dark:bg-white/5">
													<img
														src={s.qrUrl}
														alt="Payment QR Code"
														class="mx-auto w-full max-w-64 rounded"
													/>
													<div class="mt-3 space-y-1 text-center text-sm">
														<p class="font-semibold">{s.selectedBank.bankName}</p>
														<p class="font-mono text-xs">{s.selectedBank.accountNumber}</p>
														<p class="text-xs text-muted-foreground">{s.selectedBank.accountName}</p>
													</div>
												</div>
											{/if}
										</div>
									{/if}
								{/if}
							</div>

							<!-- Upload Proof -->
							<div>
								<p class="mb-3 text-sm font-medium text-muted-foreground">Step 2: Upload Proof</p>
								{#if state}
									{@const s = state}
									<div class="space-y-4">
										<div class="space-y-2">
											<Label for="proof" class="text-xs">Transaction Screenshot</Label>
											<Input id="proof" type="file" accept="image/*" bind:files={s.uploadFile} />
										</div>
										<Button
											onclick={s.handleUpload}
											disabled={!s.uploadFile || s.isUploading}
											class="w-full"
											size="sm"
										>
											{#if s.isUploading}
												Uploading...
											{:else}
												<Upload class="mr-2 h-4 w-4" />
												Upload Proof
											{/if}
										</Button>

										{#if s.uploadError}
											<p class="text-sm text-destructive">{s.uploadError}</p>
										{/if}
										{#if s.uploadSuccess}
											<div
												class="rounded-md border border-success/20 bg-success/10 p-2 text-sm text-success"
											>
												Proof uploaded! The creditor will review it.
											</div>
										{/if}
									</div>
								{/if}
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
												class="flex-1"
												{...approveProof.enhance(async ({ data: formData, submit }) => {
													formData.proofId = proof.id;
													if (state) state.isSubmitting = true;
													try {
														await submit();
													} finally {
														if (state) state.isSubmitting = false;
													invalidateAll();
												}
											})}
										>
											<Button
												type="submit"
												size="sm"
												class="w-full bg-success hover:bg-success/90"
												disabled={state?.isSubmitting}
											>
												<Check class="mr-1 h-4 w-4" /> Approve
											</Button>
										</form>
										<form
											class="flex-1"
											{...rejectProof.enhance(async ({ data: formData, submit }) => {
												formData.proofId = proof.id;
												const reason = prompt('Enter rejection reason:');
												if (reason === null) {
													return;
												}
												if (reason) formData.reason = reason;
												if (state) state.isSubmitting = true;
												try {
													await submit();
												} finally {
													if (state) state.isSubmitting = false;
													invalidateAll();
												}
											})}
										>
											<Button
												type="submit"
												size="sm"
												variant="destructive"
												class="w-full"
												disabled={state?.isSubmitting}
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
			{#if state?.isEditing && state?.canEdit}
				{@const s = state}
				<Card.Root>
					<Card.Header>
						<Card.Title class="text-lg">Edit Debt</Card.Title>
					</Card.Header>
					<Card.Content>
						<form
							{...updateDebt.enhance(async ({ submit }) => {
								const previousDebt = snapshotDebt();
								const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
								if (s.editDescription) patch.description = s.editDescription;
								if (s.editAmount) patch.amount = Number(s.editAmount);
								applyDebtPatch(patch);
								s.isSubmitting = true;
								try {
									await submit();
								} finally {
									s.isSubmitting = false;
									s.isEditing = false;
									if (previousDebt) {
										s.debt = previousDebt as any;
									}
									invalidateAll();
								}
							})}
							class="space-y-4"
						>
							<div class="space-y-2">
								<Label for="description" class="text-xs">Description</Label>
								<Input
									type="text"
									id="description"
									name="description"
									bind:value={s.editDescription}
									placeholder="What is this debt for?"
								/>
							</div>
							<div class="space-y-2">
								<Label for="amount" class="text-xs">Amount</Label>
								<Input
									type="number"
									id="amount"
									name="amount"
									bind:value={s.editAmount}
									min="1000"
									step="1000"
									placeholder="Amount in VND"
								/>
							</div>
							<div class="flex gap-2">
								<Button type="submit" disabled={s.isSubmitting} size="sm">
									{s.isSubmitting ? 'Saving...' : 'Save Changes'}
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
			{#if state && (state.validTransitions.length > 0 || state.canEdit || state.canDelete || state.canSuggestEdit)}
				{@const s = state as DebtDetailState}
				<Card.Root>
					<Card.Header>
						<Card.Title class="text-lg">Actions</Card.Title>
					</Card.Header>
					<Card.Content class="space-y-4">
						<!-- Status Transitions -->
						{#if s.validTransitions.length > 0}
							<div>
								<p class="mb-3 text-xs text-muted-foreground">Change Status</p>
								<div class="flex flex-wrap gap-2">
									{#each s.validTransitions as transition}
										<form
											{...updateDebtStatus.enhance(async ({ data: formData, submit }) => {
												formData.status = transition.status;
												const previousDebt = snapshotDebt();
												applyStatusOptimistic(transition.status);
												s.isSubmitting = true;
												try {
													await submit();
												} finally {
													s.isSubmitting = false;
													if (previousDebt) {
														s.debt = previousDebt;
													}
													invalidateAll();
												}
											})}
										>
											<Button
												type="submit"
												disabled={s.isSubmitting || transition.disabled}
												size="sm"
												variant={transition.status === DEBT_STATUS.CANCELLED ||
												transition.status === DEBT_STATUS.DISPUTED
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
						{#if s.canEdit || s.canDelete}
							<div class="flex flex-wrap gap-2 border-t pt-4">
								{#if s.canEdit && !s.isEditing}
									<Button variant="outline" size="sm" onclick={() => (s.isEditing = true)}>
										<Edit class="mr-2 h-4 w-4" />
										Edit
									</Button>
								{/if}

								{#if s.canDelete}
									<AlertDialog.Root>
										<AlertDialog.Trigger>
											{#snippet child({ props }: { props: Record<string, unknown> })}
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
													{...deleteDebt.enhance(async ({ data, submit }) => {
														if (debt) data.id = debt.id;
														if (state) state.isSubmitting = true;
														try {
															await submit();
														} finally {
															if (state) state.isSubmitting = false;
															invalidateAll();
														}
													})}
												>
													<AlertDialog.Action
														type="submit"
														disabled={s.isSubmitting}
														class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
													>
														{s.isSubmitting ? 'Deleting...' : 'Delete'}
													</AlertDialog.Action>
												</form>
											</AlertDialog.Footer>
										</AlertDialog.Content>
									</AlertDialog.Root>
								{/if}
							</div>
						{/if}

						<!-- Suggest Edit (for counterparty, not creator) -->
						{#if s.canSuggestEdit && !debt?.suggestedById}
							<div class="border-t pt-4">
								<Button
									variant="outline"
									size="sm"
									onclick={() => {
										s.suggestAmount = debt.amount?.toString() || '';
										s.suggestDescription = debt.description || '';
										s.showSuggestModal = true;
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
						{#if s.canSuggestEdit && debt?.suggestedById === data.currentUser?.id}
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
	{#if state}
		{@const s = state as DebtDetailState}
		<AlertDialog.Root bind:open={s.showMarkAsPaidModal}>
			<AlertDialog.Content>
				<AlertDialog.Header>
					<AlertDialog.Title>Mark Debt as Paid?</AlertDialog.Title>
					<AlertDialog.Description>
						All payment proofs have been approved. Would you like to mark this debt as fully paid?
					</AlertDialog.Description>
				</AlertDialog.Header>
				<AlertDialog.Footer>
					<AlertDialog.Cancel onclick={() => (s.showMarkAsPaidModal = false)}>
						Not Yet
					</AlertDialog.Cancel>
					<form
						{...updateDebtStatus.enhance(async ({ data: formData, submit }) => {
							formData.status = 'paid';
							const previousDebt = snapshotDebt();
							applyStatusOptimistic('paid');
							try {
								await submit();
							} finally {
								s.showMarkAsPaidModal = false;
								if (previousDebt) {
									s.debt = previousDebt as any;
								}
								invalidateAll();
							}
						})}
					>
					<AlertDialog.Action type="submit" class="bg-success hover:bg-success/90">
						<Check class="mr-2 h-4 w-4" />
						Yes, Mark as Paid
					</AlertDialog.Action>
				</form>
			</AlertDialog.Footer>
		</AlertDialog.Content>
	</AlertDialog.Root>
	{/if}

	<!-- Suggest Edit Modal -->
	{#if state}
		{@const s = state as DebtDetailState}
		<AlertDialog.Root bind:open={s.showSuggestModal}>
			<AlertDialog.Content>
				<AlertDialog.Header>
					<AlertDialog.Title>Suggest Edit</AlertDialog.Title>
					<AlertDialog.Description>
						Propose changes to this debt. The creator will be notified and can accept or reject your
						suggestion.
					</AlertDialog.Description>
				</AlertDialog.Header>
				<form
					{...suggestEdit.enhance(async ({ submit }) => {
						s.isSuggesting = true;
						try {
							await submit();
						} finally {
							s.isSuggesting = false;
							s.showSuggestModal = false;
							s.suggestAmount = '';
							s.suggestDescription = '';
							invalidateAll();
						}
					})}
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
					<AlertDialog.Cancel onclick={() => (s.showSuggestModal = false)}>Cancel</AlertDialog.Cancel>
					<Button type="submit" disabled={s.isSuggesting}>
						{#if s.isSuggesting}
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
	{/if}
</PageContainer>

