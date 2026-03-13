<script lang="ts">
	import { AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, Landmark, Plus, User } from '@repo/icons';
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import { Button } from '@repo/ui/components/ui/button';
	import { Label } from '@repo/ui/components/ui/label';
	import * as Card from '@repo/ui/components/ui/card';
	import * as AlertDialog from '@repo/ui/components/ui/alert-dialog';
	import { Badge } from '@repo/ui/components/ui/badge';

	import { toast } from 'svelte-sonner';
	import FormInput from '$lib/components/forms/FormInput.svelte';
	import PageContainer from '$lib/components/layout/PageContainer.svelte';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import { cn } from '$lib/utils';
	import {
		phoneSchema,
		amountClientSchema,
		descriptionSchema,
		validateField
	} from '@repo/validation/client';

	// Props with type annotation to include hasBankAccount
	interface PageData {
		hasBankAccount?: boolean;
		recentContacts?: string[];
	}
	let { form, data } = $props<{ form: any; data: PageData }>();
	let isSubmitting = $state(false);

	// Bank account check - only needed for lending money, not for borrowing
	let hasBankAccount = $derived(data.hasBankAccount ?? true);
	let canLend = $derived(hasBankAccount);
	let canBorrow = $derived(true); // Always allow borrowing regardless of bank account

	// Use $derived for direction to react to canLend changes
	let _directionState = $state('LEND');
	let direction = $derived.by(() => {
		// If can't lend and currently on LEND, switch to BORROW
		if (!hasBankAccount && _directionState === 'LEND') {
			return 'BORROW';
		}
		return _directionState;
	});

	// Recent contacts
	let recentContacts = $derived(data.recentContacts || []);

	// Form state
	const prefill = untrack(() => data.prefill);
	let phoneNumber = $state(prefill?.phone || '');
	let amount = $state(prefill?.amount || '');
	let description = $state(prefill?.description || '');

	let expiryOption = $state('never');
	let confirmDuplicate = $state(false);

	// Autocomplete state
	let showAutocomplete = $state(false);
	let autocompleteContacts = $derived.by(() => {
		if (!phoneNumber || phoneNumber.length < 2) return recentContacts.slice(0, 5);
		return recentContacts.filter((c: string) => c.includes(phoneNumber)).slice(0, 5);
	});

	// Preview modal state
	let showPreviewModal = $state(false);
	let formElement: HTMLFormElement | undefined = $state(undefined);

	// Duplicate modal state
	let showDuplicateModal = $state(false);
	let duplicateDebts = $state<
		Array<{ id: string; amount: number; description: string | null; createdAt: string }>
	>([]);

	// Expiry options
	const expiryOptions = [
		{
			value: 'never',
			label: 'No expiry (forever)',
			description: 'Debt stays until manually resolved'
		},
		{ value: '7d', label: '7 days', description: 'Auto-cancel if not confirmed in 1 week' },
		{ value: '30d', label: '30 days', description: 'Auto-cancel if not confirmed in 1 month' },
		{ value: '90d', label: '90 days', description: 'Auto-cancel if not confirmed in 3 months' }
	];

	// Validation states driven by shared schemas
	let phoneResult = $derived(validateField(phoneSchema, phoneNumber));
	let amountResult = $derived(validateField(amountClientSchema, amount));
	let descriptionResult = $derived(validateField(descriptionSchema, description));

	$effect(() => {
		if (form?.message) {
			// Handle duplicate warning
			if (form?.code === 'DUPLICATE_WARNING' && form?.duplicates) {
				duplicateDebts = form.duplicates;
				showDuplicateModal = true;
				isSubmitting = false;
				return;
			}
			toast.error(form.message);
			console.error('[Frontend] Form Error:', form.message);
			isSubmitting = false;
		}
	});

	function handleConfirmDuplicate() {
		confirmDuplicate = true;
		showDuplicateModal = false;
		// Submit form again with confirmDuplicate flag
		const formEl = document.querySelector('form');
		if (formEl) {
			isSubmitting = true;
			formEl.requestSubmit();
		}
	}

	function formatDate(dateStr: string) {
		return new Date(dateStr).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function formatCurrency(amount: number) {
		return new Intl.NumberFormat('vi-VN', {
			style: 'currency',
			currency: 'VND',
			maximumFractionDigits: 0
		}).format(amount);
	}
</script>

<svelte:head>
	<title>Create Debt - Buddy Wallet</title>
</svelte:head>

<PageContainer maxWidth="max-w-2xl">
	<a
		href="/dashboard"
		class="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
	>
		<ArrowLeft class="h-4 w-4" />
		Back to Dashboard
	</a>

	<PageHeader title="Add New Debt" description="Record a transaction with a friend" />

	<!-- Bank Account Warning -->
	{#if !hasBankAccount}
		<Card.Root class="mb-6 border-destructive bg-destructive/5">
			<Card.Content class="py-6 text-center">
				<div
					class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10"
				>
					<Landmark class="h-8 w-8 text-destructive" />
				</div>
				<h3 class="mb-2 text-lg font-semibold text-destructive">Bank Account Required</h3>
				<p class="mb-4 text-sm text-muted-foreground">
					You need to add at least one bank account before creating debts where others owe you
					money. Without a bank account, debtors cannot scan QR codes to pay you.
				</p>
				<Button href="/settings/banks" size="lg">
					<Plus class="mr-2 h-4 w-4" />
					Add Bank Account Now
				</Button>
				<p class="mt-4 text-xs text-muted-foreground">
					You can still record debts where you owe others money.
				</p>
			</Card.Content>
		</Card.Root>
	{/if}

	<Card.Root>
		<Card.Content class="pt-6">
			<form
				method="POST"
				use:enhance={() => {
					isSubmitting = true;
					return async ({ update }) => {
						await update();
						isSubmitting = false;
					};
				}}
				class="space-y-6"
			>
				<!-- Phone Number with Autocomplete -->
				<div class="space-y-2">
					<Label for="counterpartyPhone" class="text-sm font-medium">Phone Number *</Label>
					<div class="relative">
						<input
							type="tel"
							id="counterpartyPhone"
							name="counterpartyPhone"
							placeholder="0901234567"
							bind:value={phoneNumber}
							onfocus={() => (showAutocomplete = true)}
							onblur={() => setTimeout(() => (showAutocomplete = false), 200)}
							required
							class={cn(
								'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
								phoneResult.state === 'error' &&
									'ring-2 ring-destructive focus-visible:ring-destructive',
								phoneResult.state === 'success' && 'ring-2 ring-success focus-visible:ring-success',
								phoneResult.state === 'warning' && 'ring-2 ring-warning focus-visible:ring-warning'
							)}
						/>

						<!-- Recent contacts autocomplete -->
						{#if showAutocomplete && autocompleteContacts.length > 0}
							<div class="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md">
								<div class="py-1">
									<p class="px-3 py-1 text-xs text-muted-foreground">Recent contacts</p>
									{#each autocompleteContacts as contact}
										<button
											type="button"
											class="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
											onmousedown={() => {
												phoneNumber = contact;
												showAutocomplete = false;
											}}
										>
											<User class="h-4 w-4 text-muted-foreground" />
											{contact}
										</button>
									{/each}
								</div>
							</div>
						{/if}
					</div>
					{#if phoneResult.state !== 'default'}
						<p class={cn("text-xs", phoneResult.state === 'error' ? "text-destructive" : phoneResult.state === 'success' ? "text-success" : "text-warning")}>
							{phoneResult.message}
						</p>
					{/if}
				</div>
				<p class="-mt-3 text-xs text-muted-foreground">
					Must match the phone number they used to sign up
				</p>

				<div class="space-y-3">
					<Label class="text-sm">Direction</Label>
					<div class="grid grid-cols-2 gap-3">
						<!-- LEND option - disabled if no bank account -->
						<div>
							<input
								type="radio"
								name="direction"
								value="LEND"
								id="lend"
								class="peer sr-only"
								checked={direction === 'LEND'}
								onchange={() => (_directionState = 'LEND')}
								disabled={!canLend}
							/>
							<Label
								for="lend"
								class={cn(
									'flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors',
									!canLend && 'cursor-not-allowed opacity-50',
									direction === 'LEND' && canLend
										? 'border-success bg-success/5'
										: 'border-muted hover:bg-muted/50'
								)}
							>
								<ArrowUp
									class={cn('h-6 w-6', canLend ? 'text-success' : 'text-muted-foreground')}
								/>
								<span class="text-sm font-semibold">I Lent</span>
								<span class="text-xs text-muted-foreground">They owe me</span>
								{#if !canLend}
									<Badge variant="destructive" class="mt-1 text-xs">Requires bank account</Badge>
								{/if}
							</Label>
						</div>
						<!-- BORROW option - always enabled -->
						<div>
							<input
								type="radio"
								name="direction"
								value="BORROW"
								id="borrow"
								class="peer sr-only"
								checked={direction === 'BORROW'}
								onchange={() => (_directionState = 'BORROW')}
							/>
							<Label
								for="borrow"
								class={cn(
									'flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors',
									direction === 'BORROW'
										? 'border-destructive bg-destructive/5'
										: 'border-muted hover:bg-muted/50'
								)}
							>
								<ArrowDown class="h-6 w-6 text-destructive" />
								<span class="text-sm font-semibold">I Borrowed</span>
								<span class="text-xs text-muted-foreground">I owe them</span>
							</Label>
						</div>
					</div>
				</div>

				<FormInput
					label="Amount (VND)"
					name="amount"
					type="number"
					placeholder="100000"
					bind:value={amount}
					validationState={amountResult.state}
					success={amountResult.state === 'success' ? amountResult.message : undefined}
					error={amountResult.state === 'error' ? amountResult.message : undefined}
					warning={amountResult.state === 'warning' ? amountResult.message : undefined}
					min="1000"
					step="1000"
					required
				/>

				<FormInput
					label="Description"
					name="description"
					type="text"
					placeholder="Lunch, movie tickets, etc."
					bind:value={description}
					validationState={descriptionResult.state}
					success={descriptionResult.state === 'success' ? descriptionResult.message : undefined}
					error={descriptionResult.state === 'error' ? descriptionResult.message : undefined}
					required
				/>

				<!-- Expiry Option -->
				<div class="space-y-2">
					<Label class="text-sm">Confirmation Deadline</Label>
					<select
						bind:value={expiryOption}
						class="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
					>
						{#each expiryOptions as option}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
					<p class="text-xs text-muted-foreground">
						If the other party doesn't confirm within this period, the debt will be auto-cancelled.
					</p>
				</div>

				<input type="hidden" name="expiryOption" value={expiryOption} />
				<input type="hidden" name="confirmDuplicate" value={confirmDuplicate ? 'true' : 'false'} />

				<div class="flex gap-3">
					<Button
						type="button"
						variant="outline"
						class="flex-1"
						disabled={isSubmitting ||
							phoneResult.state === 'error' ||
							amountResult.state === 'error' ||
							descriptionResult.state === 'error' ||
							!phoneNumber ||
							!amount ||
							!description}
						onclick={() => (showPreviewModal = true)}
					>
						Preview
					</Button>
					<Button
						type="submit"
						class="flex-1"
						disabled={isSubmitting ||
							phoneResult.state === 'error' ||
							amountResult.state === 'error' ||
							descriptionResult.state === 'error'}
					>
						{isSubmitting ? 'Creating...' : 'Create Debt'}
					</Button>
				</div>
			</form>
		</Card.Content>
	</Card.Root>

	<!-- Preview Modal -->
	<AlertDialog.Root bind:open={showPreviewModal}>
		<AlertDialog.Content>
			<AlertDialog.Header>
				<AlertDialog.Title>Confirm Debt Details</AlertDialog.Title>
				<AlertDialog.Description>
					Please review the information before creating this debt record.
				</AlertDialog.Description>
			</AlertDialog.Header>

			<div class="my-4 space-y-4">
				<div class="space-y-3 rounded-lg border bg-muted/50 p-4">
					<div class="flex items-center justify-between">
						<span class="text-sm text-muted-foreground">Direction</span>
						<Badge variant={direction === 'LEND' ? 'default' : 'secondary'}>
							{#if direction === 'LEND'}
								<ArrowUp class="mr-1 h-3 w-3" />
								They Owe You
							{:else}
								<ArrowDown class="mr-1 h-3 w-3" />
								You Owe Them
							{/if}
						</Badge>
					</div>

					<div class="flex items-center justify-between">
						<span class="text-sm text-muted-foreground">Counterparty</span>
						<span class="font-medium">{phoneNumber}</span>
					</div>

					<div class="flex items-center justify-between">
						<span class="text-sm text-muted-foreground">Amount</span>
						<span class="text-lg font-bold">{formatCurrency(parseFloat(amount) || 0)}</span>
					</div>

					<div class="flex items-start justify-between">
						<span class="text-sm text-muted-foreground">Description</span>
						<span class="max-w-50 text-right font-medium">{description}</span>
					</div>

					<div class="flex items-center justify-between">
						<span class="text-sm text-muted-foreground">Expiry</span>
						<span class="text-sm">{expiryOptions.find((o) => o.value === expiryOption)?.label}</span
						>
					</div>
				</div>

				<p class="text-center text-xs text-muted-foreground">
					The other party will need to confirm this debt before it becomes active.
				</p>
			</div>

			<AlertDialog.Footer>
				<AlertDialog.Cancel onclick={() => (showPreviewModal = false)}>Edit</AlertDialog.Cancel>
				<AlertDialog.Action
					onclick={() => {
						showPreviewModal = false;
						// Submit the form
						const form = document.querySelector('form');
						if (form) {
							isSubmitting = true;
							form.requestSubmit();
						}
					}}
				>
					Confirm & Create
				</AlertDialog.Action>
			</AlertDialog.Footer>
		</AlertDialog.Content>
	</AlertDialog.Root>

	<!-- Duplicate Warning Modal -->
	<AlertDialog.Root bind:open={showDuplicateModal}>
		<AlertDialog.Content>
			<AlertDialog.Header>
				<AlertDialog.Title class="flex items-center gap-2">
					<AlertTriangle class="h-5 w-5 text-amber-500" />
					Potential Duplicate Found
				</AlertDialog.Title>
				<AlertDialog.Description>
					We found similar debts with the same parties created recently. Are you sure this isn't a
					duplicate?
				</AlertDialog.Description>
			</AlertDialog.Header>

			<div class="my-4 space-y-2">
				{#each duplicateDebts as debt}
					<div class="rounded-lg border bg-muted/50 p-3 text-sm">
						<div class="flex items-center justify-between">
							<span class="font-semibold">{formatCurrency(debt.amount)}</span>
							<span class="text-xs text-muted-foreground">{formatDate(debt.createdAt)}</span>
						</div>
						{#if debt.description}
							<p class="mt-1 text-muted-foreground">{debt.description}</p>
						{/if}
					</div>
				{/each}
			</div>

			<AlertDialog.Footer>
				<AlertDialog.Cancel onclick={() => (showDuplicateModal = false)}>Cancel</AlertDialog.Cancel>
				<AlertDialog.Action onclick={handleConfirmDuplicate}>Create Anyway</AlertDialog.Action>
			</AlertDialog.Footer>
		</AlertDialog.Content>
	</AlertDialog.Root>
</PageContainer>
