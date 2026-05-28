<script lang="ts">
	import { resolve } from '$app/paths';
	import AlertTriangle from '~icons/lucide/alert-triangle';
import ArrowDown from '~icons/lucide/arrow-down';
import ArrowLeft from '~icons/lucide/arrow-left';
import ArrowUp from '~icons/lucide/arrow-up';
import Landmark from '~icons/lucide/landmark';
import Plus from '~icons/lucide/plus';
import User from '~icons/lucide/user';
	import { goto } from '$app/navigation';

	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { Badge } from '$lib/components/ui/badge';
	import * as Select from '$lib/components/ui/select';

	import { toast } from 'svelte-sonner';
	import FormInput from '$lib/components/forms/FormInput.svelte';
	import PageContainer from '$lib/components/layout/PageContainer.svelte';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import { cn } from '$lib/utils';
	import { formatDate } from '@repo/utils/format';
	import { createDebtRemote } from '$lib/remotes/debts.remote';
	import { type PageData } from './$types';
	import { CreateDebtState } from './create-debt.svelte';

	let { data } = $props<{ data: PageData }>();
	const pageState = new CreateDebtState({
		get prefill() { return data.prefill; },
		get hasBankAccount() { return data.hasBankAccount; },
		get recentContacts() { return data.recentContacts; }
	});

	let formElement: HTMLFormElement | undefined = $state(undefined);

	// Handle remote function result
	$effect(() => {
		const result = createDebtRemote.result;
		if (!result) return;

		if (result.code === 'DUPLICATE_WARNING' && result.duplicates) {
			pageState.duplicateDebts = result.duplicates as unknown as Array<{ id: string; amount: number; description: string | null; createdAt: string }>;
			pageState.showDuplicateModal = true;
			pageState.isSubmitting = false;
			return;
		}

		if (result.success) {
			toast.success('Debt created successfully!');
			goto(resolve('/dashboard', {}));
		} else if (result.message) {
			toast.error(result.message as string);
			pageState.isSubmitting = false;
		}
	});

	function handleConfirmDuplicate() {
		pageState.confirmDuplicate = true;
		pageState.showDuplicateModal = false;
		// Submit form again with confirmDuplicate flag
		if (formElement) {
			pageState.isSubmitting = true;
			formElement.requestSubmit();
		}
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
		href={resolve(`/dashboard`, {})}
		class="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
	>
		<ArrowLeft class="h-4 w-4" />
		Back to Dashboard
	</a>

	<PageHeader title="Add New Debt" description="Record a transaction with a friend" />

	<!-- Bank Account Warning -->
	{#if !pageState.canLend}
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
				<Button href={resolve(`/settings/banks`, {})} size="lg">
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
				bind:this={formElement}
				{...createDebtRemote.enhance(async ({ submit }: { submit: () => Promise<void> }) => {
					pageState.isSubmitting = true;
					try {
						await submit();
					} catch {
						toast.error('Network error. Please try again.');
						pageState.isSubmitting = false;
					}
				})}
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
							bind:value={pageState.phoneNumber}
							onfocus={() => (pageState.showAutocomplete = true)}
							onblur={() => setTimeout(() => (pageState.showAutocomplete = false), 200)}
							required
							class={cn(
								'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
								pageState.phoneResult.state === 'error' &&
									'ring-2 ring-destructive focus-visible:ring-destructive',
								pageState.phoneResult.state === 'success' && 'ring-2 ring-success focus-visible:ring-success',
								pageState.phoneResult.state === 'warning' && 'ring-2 ring-warning focus-visible:ring-warning'
							)}
						/>

						<!-- Recent contacts autocomplete -->
						{#if pageState.showAutocomplete && pageState.autocompleteContacts.length > 0}
							<div class="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md">
								<div class="py-1">
									<p class="px-3 py-1 text-xs text-muted-foreground">Recent contacts</p>
									{#each pageState.autocompleteContacts as contact}
										<button
											type="button"
											class="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
											onmousedown={() => {
												pageState.phoneNumber = contact;
												pageState.showAutocomplete = false;
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
					{#if pageState.phoneResult.state !== 'default'}
						<p class={cn("text-xs", pageState.phoneResult.state === 'error' ? "text-destructive" : pageState.phoneResult.state === 'success' ? "text-success" : "text-warning")}>
							{pageState.phoneResult.message}
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
								checked={pageState.direction === 'LEND'}
								onchange={() => (pageState.direction = 'LEND')}
								disabled={!pageState.canLend}
							/>
							<Label
								for="lend"
								class={cn(
									'flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors',
									!pageState.canLend && 'cursor-not-allowed opacity-50',
									pageState.direction === 'LEND' && pageState.canLend
										? 'border-success bg-success/5'
										: 'border-muted hover:bg-muted/50'
								)}
							>
								<ArrowUp
									class={cn('h-6 w-6', pageState.canLend ? 'text-success' : 'text-muted-foreground')}
								/>
								<span class="text-sm font-semibold">I Lent</span>
								<span class="text-xs text-muted-foreground">They owe me</span>
								{#if !pageState.canLend}
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
								checked={pageState.direction === 'BORROW'}
								onchange={() => (pageState.direction = 'BORROW')}
							/>
							<Label
								for="borrow"
								class={cn(
									'flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors',
									pageState.direction === 'BORROW'
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
					bind:value={pageState.amount}
					validationState={pageState.amountResult.state}
					success={pageState.amountResult.state === 'success' ? pageState.amountResult.message : undefined}
					error={pageState.amountResult.state === 'error' ? pageState.amountResult.message : undefined}
					warning={pageState.amountResult.state === 'warning' ? pageState.amountResult.message : undefined}
					min="1000"
					step="1000"
					required
				/>

				<FormInput
					label="Description"
					name="description"
					type="text"
					placeholder="Lunch, movie tickets, etc."
					bind:value={pageState.description}
					validationState={pageState.descriptionResult.state}
					success={pageState.descriptionResult.state === 'success' ? pageState.descriptionResult.message : undefined}
					error={pageState.descriptionResult.state === 'error' ? pageState.descriptionResult.message : undefined}
					required
				/>

				<!-- Expiry Option -->
				<div class="space-y-2">
					<Label class="text-sm">Confirmation Deadline</Label>
					<Select.Root bind:value={pageState.expiryOption}>
						<Select.Trigger class="w-full">
							<Select.Value />
						</Select.Trigger>
						<Select.Content>
							{#each pageState.expiryOptions as option}
								<Select.Item value={option.value} label={option.label} />
							{/each}
						</Select.Content>
					</Select.Root>
					<p class="text-xs text-muted-foreground">
						If the other party doesn't confirm within this period, the debt will be auto-cancelled.
					</p>
				</div>

				<!-- Confirm Duplicate Checkbox (visible when duplicates detected) -->
				{#if pageState.confirmDuplicate}
					<div class="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
						<label class="flex items-center gap-2 text-sm">
							<input
								type="checkbox"
								name="confirmDuplicate"
								value="true"
								checked={pageState.confirmDuplicate}
								class="h-4 w-4 rounded border-amber-400"
							/>
							<span class="font-medium text-amber-800 dark:text-amber-200">
								I confirm this is not a duplicate — create anyway
							</span>
						</label>
					</div>
				{/if}

				<div class="flex gap-3">
					<Button
						type="button"
						variant="outline"
						class="flex-1"
						disabled={pageState.isSubmitting || !pageState.isValid}
						onclick={() => (pageState.showPreviewModal = true)}
					>
						Preview
					</Button>
					<Button
						type="submit"
						class="flex-1"
						disabled={pageState.isSubmitting ||
							pageState.phoneResult.state === 'error' ||
							pageState.amountResult.state === 'error' ||
							pageState.descriptionResult.state === 'error'}
					>
						{pageState.isSubmitting ? 'Creating...' : 'Create Debt'}
					</Button>
				</div>
			</form>
		</Card.Content>
	</Card.Root>

	<!-- Preview Modal -->
	<AlertDialog.Root bind:open={pageState.showPreviewModal}>
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
						<Badge variant={pageState.direction === 'LEND' ? 'default' : 'secondary'}>
							{#if pageState.direction === 'LEND'}
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
						<span class="font-medium">{pageState.phoneNumber}</span>
					</div>

					<div class="flex items-center justify-between">
						<span class="text-sm text-muted-foreground">Amount</span>
						<span class="text-lg font-bold">{formatCurrency(parseFloat(pageState.amount) || 0)}</span>
					</div>

					<div class="flex items-start justify-between">
						<span class="text-sm text-muted-foreground">Description</span>
						<span class="max-w-50 text-right font-medium">{pageState.description}</span>
					</div>

					<div class="flex items-center justify-between">
						<span class="text-sm text-muted-foreground">Expiry</span>
						<span class="text-sm">{pageState.expiryOptions.find((o) => o.value === pageState.expiryOption)?.label}</span
						>
					</div>
				</div>

				<p class="text-center text-xs text-muted-foreground">
					The other party will need to confirm this debt before it becomes active.
				</p>
			</div>

			<AlertDialog.Footer>
				<AlertDialog.Cancel onclick={() => (pageState.showPreviewModal = false)}>Edit</AlertDialog.Cancel>
				<AlertDialog.Action
					onclick={() => {
						pageState.showPreviewModal = false;
						// Submit the form
						if (formElement) {
							pageState.isSubmitting = true;
							formElement.requestSubmit();
						}
					}}
				>
					Confirm & Create
				</AlertDialog.Action>
			</AlertDialog.Footer>
		</AlertDialog.Content>
	</AlertDialog.Root>

	<!-- Duplicate Warning Modal -->
	<AlertDialog.Root bind:open={pageState.showDuplicateModal}>
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
				{#each pageState.duplicateDebts as debt}
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
				<AlertDialog.Cancel onclick={() => (pageState.showDuplicateModal = false)}>Cancel</AlertDialog.Cancel>
				<AlertDialog.Action onclick={handleConfirmDuplicate}>Create Anyway</AlertDialog.Action>
			</AlertDialog.Footer>
		</AlertDialog.Content>
	</AlertDialog.Root>
</PageContainer>

