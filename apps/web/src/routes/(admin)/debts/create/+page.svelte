<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '@repo/ui/components/ui/button';
	import { Label } from '@repo/ui/components/ui/label';
	import * as Card from '@repo/ui/components/ui/card';
	import { ArrowLeft, ArrowUp, ArrowDown } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import FormInput from '$lib/components/forms/FormInput.svelte';
	import PageContainer from '$lib/components/layout/PageContainer.svelte';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import { cn } from '$lib/utils';

	let { form } = $props();
	let isSubmitting = $state(false);

	// Form state
	let phoneNumber = $state('');
	let amount = $state('');
	let description = $state('');
	let direction = $state('LEND');

	// Validation states
	let phoneValidation = $state<'default' | 'success' | 'error' | 'warning'>('default');
	let phoneMessage = $state('');
	let amountValidation = $state<'default' | 'success' | 'error' | 'warning'>('default');
	let amountMessage = $state('');
	let descriptionValidation = $state<'default' | 'success' | 'error' | 'warning'>('default');
	let descriptionMessage = $state('');

	// Validation logic
	$effect(() => {
		// Phone validation
		if (phoneNumber.length === 0) {
			phoneValidation = 'default';
			phoneMessage = '';
		} else if (phoneNumber.length < 10) {
			phoneValidation = 'error';
			phoneMessage = 'Phone number must be at least 10 digits';
		} else if (!/^0\d{9}$/.test(phoneNumber)) {
			phoneValidation = 'warning';
			phoneMessage = 'Phone should start with 0 and be 10 digits';
		} else {
			phoneValidation = 'success';
			phoneMessage = 'Phone number looks good';
		}

		// Amount validation
		if (amount === '') {
			amountValidation = 'default';
			amountMessage = '';
		} else {
			const numAmount = parseFloat(amount);
			if (isNaN(numAmount) || numAmount <= 0) {
				amountValidation = 'error';
				amountMessage = 'Amount must be greater than 0';
			} else if (numAmount < 1000) {
				amountValidation = 'warning';
				amountMessage = 'Very small amount';
			} else {
				amountValidation = 'success';
				amountMessage = 'Amount confirmed';
			}
		}

		// Description validation
		if (description.length === 0) {
			descriptionValidation = 'default';
			descriptionMessage = '';
		} else if (description.length < 3) {
			descriptionValidation = 'error';
			descriptionMessage = 'Description must be at least 3 characters';
		} else {
			descriptionValidation = 'success';
			descriptionMessage = 'Description looks good';
		}
	});

	$effect(() => {
		if (form?.message) {
			toast.error(form.message);
			console.error('[Frontend] Form Error:', form.message);
			isSubmitting = false;
		}
	});
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
				<FormInput
					label="Phone Number"
					name="counterpartyPhone"
					type="tel"
					placeholder="0901234567"
					bind:value={phoneNumber}
					validationState={phoneValidation}
					success={phoneValidation === 'success' ? phoneMessage : undefined}
					error={phoneValidation === 'error' ? phoneMessage : undefined}
					warning={phoneValidation === 'warning' ? phoneMessage : undefined}
					required
				/>
				<p class="-mt-3 text-xs text-muted-foreground">
					Must match the phone number they used to sign up
				</p>

				<div class="space-y-3">
					<Label class="text-sm">Direction</Label>
					<div class="grid grid-cols-2 gap-3">
						<div>
							<input
								type="radio"
								name="direction"
								value="LEND"
								id="lend"
								class="peer sr-only"
								bind:group={direction}
							/>
							<Label
								for="lend"
								class={cn(
									'flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors',
									direction === 'LEND'
										? 'border-success bg-success/5'
										: 'border-muted hover:bg-muted/50'
								)}
							>
								<ArrowUp class="h-6 w-6 text-success" />
								<span class="text-sm font-semibold">I Lent</span>
								<span class="text-xs text-muted-foreground">They owe me</span>
							</Label>
						</div>
						<div>
							<input
								type="radio"
								name="direction"
								value="BORROW"
								id="borrow"
								class="peer sr-only"
								bind:group={direction}
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
					validationState={amountValidation}
					success={amountValidation === 'success' ? amountMessage : undefined}
					error={amountValidation === 'error' ? amountMessage : undefined}
					warning={amountValidation === 'warning' ? amountMessage : undefined}
					min="1"
					step="1000"
					required
				/>

				<FormInput
					label="Description"
					name="description"
					type="text"
					placeholder="Lunch, movie tickets, etc."
					bind:value={description}
					validationState={descriptionValidation}
					success={descriptionValidation === 'success' ? descriptionMessage : undefined}
					error={descriptionValidation === 'error' ? descriptionMessage : undefined}
					required
				/>

				<Button
					type="submit"
					class="w-full"
					disabled={isSubmitting ||
						phoneValidation === 'error' ||
						amountValidation === 'error' ||
						descriptionValidation === 'error'}
				>
					{isSubmitting ? 'Creating...' : 'Create Debt Record'}
				</Button>
			</form>
		</Card.Content>
	</Card.Root>
</PageContainer>
