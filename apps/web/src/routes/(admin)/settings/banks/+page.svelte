<script lang="ts">
	import { Landmark, Pencil, Plus, Trash2 } from '@repo/icons';
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import { Button } from '@repo/ui/components/ui/button';
	import { Label } from '@repo/ui/components/ui/label';
	import * as Card from '@repo/ui/components/ui/card';
	import { Separator } from '@repo/ui/components/ui/separator';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import FormInput from '$lib/components/forms/FormInput.svelte';
	// Icons

	let { data, form } = $props();

	// Toast on form results
	$effect(() => {
		if (form?.message) {
			toast.error(form.message);
		}
		if (form?.success) {
			toast.success('Bank account updated successfully');
		}
	});

	// Provide fallback array to avoid undefined errors if data is somehow missing
	let accounts = $derived(data.accounts || []);
	let banks = $derived(data.banks || []);

	let isAdding = $state(false);
	let isSubmitting = $state(false);
	let searchQuery = $state('');

	// Selected bank for new account
	let selectedBankCode = $state('');
	let selectedBank = $derived(banks.find((b: any) => b.code === selectedBankCode));

	let filteredBanks = $derived(
		banks.filter(
			(b: any) =>
				b.shortName.toLowerCase().includes(searchQuery.toLowerCase()) ||
				b.name.toLowerCase().includes(searchQuery.toLowerCase())
		)
	);

	// Form state
	let accountNumber = $state('');
	let accountName = $state('');

	// Validation state
	type ValidationState = 'default' | 'success' | 'error' | 'warning';
	let accountNumberValidation = $state<ValidationState>('default');
	let accountNumberMessage = $state('');
	let accountNameValidation = $state<ValidationState>('default');
	let accountNameMessage = $state('');

	// Real-time account number validation
	$effect(() => {
		if (accountNumber === '') {
			accountNumberValidation = 'default';
			accountNumberMessage = '';
			return;
		}

		if (accountNumber.length < 6) {
			accountNumberValidation = 'error';
			accountNumberMessage = 'Account number must be at least 6 digits';
			return;
		}

		if (!/^\d+$/.test(accountNumber)) {
			accountNumberValidation = 'error';
			accountNumberMessage = 'Account number must contain only digits';
			return;
		}

		accountNumberValidation = 'success';
		accountNumberMessage = 'Account number looks good';
	});

	// Real-time account name validation
	$effect(() => {
		if (accountName === '') {
			accountNameValidation = 'default';
			accountNameMessage = '';
			return;
		}

		if (accountName.length < 3) {
			accountNameValidation = 'error';
			accountNameMessage = 'Account name must be at least 3 characters';
			return;
		}

		if (accountName !== accountName.toUpperCase()) {
			accountNameValidation = 'warning';
			accountNameMessage = 'Uppercase recommended for compatibility';
			return;
		}

		if (
			/[��??��?????a?????��???�?????��??i��??��?????o?????��??uu??????�???d]/i.test(accountName)
		) {
			accountNameValidation = 'warning';
			accountNameMessage = 'Remove Vietnamese accents for better compatibility';
			return;
		}

		accountNameValidation = 'success';
		accountNameMessage = 'Account name looks good';
	});

	// Edit state
	let isEditing = $state(false);
	let editingId = $state('');

	// Delete state
	let deleteId = $state('');
	let isDeleting = $state(false);

	// Reset form when dialog closes
	$effect(() => {
		if (!isAdding && !isEditing) {
			accountNumber = '';
			accountName = '';
			selectedBankCode = '';
			editingId = '';
			accountNumberValidation = 'default';
			accountNumberMessage = '';
			accountNameValidation = 'default';
			accountNameMessage = '';
		}
	});

	function startEdit(account: any) {
		isEditing = true;
		editingId = account.id;
		accountNumber = account.accountNumber;
		accountName = account.accountName;

		// Find bank code by name/bin (since we might not have code stored directly if it changed)
		// Usually we store bankName/bin. Let's try to match by bin first.
		const bank = banks.find((b: any) => b.bin === account.bankBin);
		if (bank) {
			selectedBankCode = bank.code;
		} else {
			// Fallback or handle error?
			selectedBankCode = '';
		}

		// Validate immediately
		accountNumberValidation = 'success';
		accountNameValidation = 'success';
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h3 class="text-lg font-medium">Bank Accounts</h3>
			<p class="text-sm text-muted-foreground">Manage your bank accounts for receiving payments.</p>
		</div>
		<Button size="sm" onclick={() => (isAdding = true)}>
			<Plus class="mr-2 h-4 w-4" />
			Add Account
		</Button>

		<Dialog.Root
			open={isAdding || isEditing}
			onOpenChange={(open: boolean) => {
				if (!open) {
					isAdding = false;
					isEditing = false;
				}
			}}
		>
			<Dialog.Content class="sm:max-w-md">
				<Dialog.Header>
					<Dialog.Title>{isEditing ? 'Edit Bank Account' : 'Add Bank Account'}</Dialog.Title>
					<Dialog.Description>
						{isEditing
							? 'Update your bank account details.'
							: 'Enter your bank details to receive payments via VietQR.'}
					</Dialog.Description>
				</Dialog.Header>

				<form
					method="POST"
					action={isEditing ? '?/edit' : '?/add'}
					use:enhance={() => {
						isSubmitting = true;
						return async ({ update, result }) => {
							await update();
							isSubmitting = false;
							if (result.type === 'success') {
								isAdding = false;
								isEditing = false;
								selectedBankCode = '';
							}
						};
					}}
					class="grid gap-4 py-4"
				>
					{#if isEditing}
						<input type="hidden" name="id" value={editingId} />
					{/if}
					<div class="grid gap-2">
						<Label>Bank</Label>
						<select
							class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
							bind:value={selectedBankCode}
							name="bankCode"
							required
						>
							<option value="" disabled selected>Select a bank</option>
							{#each banks as bank}
								<option value={bank.code}>{bank.shortName} - {bank.name}</option>
							{/each}
						</select>
						{#if selectedBank}
							<input type="hidden" name="bankName" value={selectedBank.shortName} />
							<input type="hidden" name="bankBin" value={selectedBank.bin} />
							<div class="flex items-center gap-2 text-sm text-muted-foreground">
								<img src={selectedBank.logo} alt={selectedBank.shortName} class="h-6 w-auto" />
								<span>{selectedBank.name}</span>
							</div>
						{/if}
					</div>

					<div class="grid gap-2">
						<FormInput
							id="accountNumber"
							name="accountNumber"
							label="Account Number"
							type="text"
							bind:value={accountNumber}
							placeholder="e.g. 1903..."
							validationState={accountNumberValidation}
							error={accountNumberValidation === 'error' ? accountNumberMessage : undefined}
							success={accountNumberValidation === 'success' ? accountNumberMessage : undefined}
							required
						/>
					</div>

					<div class="grid gap-2">
						<FormInput
							id="accountName"
							name="accountName"
							label="Account Name"
							type="text"
							bind:value={accountName}
							placeholder="e.g. NGUYEN VAN A"
							validationState={accountNameValidation}
							error={accountNameValidation === 'error' ? accountNameMessage : undefined}
							success={accountNameValidation === 'success' ? accountNameMessage : undefined}
							warning={accountNameValidation === 'warning' ? accountNameMessage : undefined}
							helpText="Optional � verify in your banking app. Uppercase, no accents recommended."
						/>
					</div>

					<div class="flex items-center space-x-2">
						<input
							type="checkbox"
							id="isDefault"
							name="isDefault"
							class="h-4 w-4 rounded border-gray-300"
						/>
						<Label for="isDefault">Set as default account</Label>
					</div>

					<Dialog.Footer>
						<Button
							type="submit"
							disabled={isSubmitting ||
								!selectedBankCode ||
								accountNumberValidation === 'error' ||
								accountNameValidation === 'error' ||
								accountNumber === ''}
						>
							{isSubmitting
								? isEditing
									? 'Updating...'
									: 'Adding...'
								: isEditing
									? 'Update Account'
									: 'Add Account'}
						</Button>
					</Dialog.Footer>
				</form>
			</Dialog.Content>
		</Dialog.Root>
	</div>
	<Separator />

	{#if form?.message}
		<div class="rounded-md bg-red-50 p-3 text-sm text-red-500 dark:bg-red-900/10">
			{form.message}
		</div>
	{/if}

	<div class="space-y-4">
		{#if accounts.length === 0}
			<div
				class="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center text-muted-foreground"
			>
				<Landmark class="mb-4 h-8 w-8 opacity-50" />
				<p>No bank accounts added yet.</p>
				<p class="text-sm">Add an account to easier receive payments.</p>
			</div>
		{:else}
			{#each accounts as account}
				<Card.Root>
					<div class="flex items-center justify-between p-6">
						<div class="flex items-center gap-4">
							<div class="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
								<Landmark class="h-5 w-5 text-muted-foreground" />
							</div>
							<div>
								<div class="flex items-center gap-2">
									<p class="font-medium">{account.bankName}</p>
									{#if account.isDefault}
										<span
											class="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
											>Default</span
										>
									{/if}
								</div>
								<p class="text-sm text-muted-foreground">
									{account.accountNumber} � {account.accountName}
								</p>
							</div>
						</div>
						<div class="flex items-center gap-1">
							<Button
								variant="ghost"
								size="icon"
								class="text-muted-foreground hover:text-foreground"
								onclick={() => startEdit(account)}
							>
								<Pencil class="h-4 w-4" />
							</Button>

							<AlertDialog.Root
								open={deleteId === account.id}
								onOpenChange={(open: boolean) => {
									if (!open) deleteId = '';
								}}
							>
								<AlertDialog.Trigger>
									{#snippet child({ props }: { props: Record<string, any> })}
										<Button
											variant="ghost"
											size="icon"
											class="text-muted-foreground hover:text-destructive"
											onclick={() => (deleteId = account.id)}
											{...props}
										>
											<Trash2 class="h-4 w-4" />
										</Button>
									{/snippet}
								</AlertDialog.Trigger>
								<AlertDialog.Content>
									<AlertDialog.Header>
										<AlertDialog.Title>Delete Bank Account</AlertDialog.Title>
										<AlertDialog.Description>
											Are you sure you want to delete this bank account? This action cannot be
											undone.
										</AlertDialog.Description>
									</AlertDialog.Header>
									<AlertDialog.Footer>
										<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
										<form
											method="POST"
											action="?/delete"
											use:enhance={() => {
												isDeleting = true;
												return async ({ update }) => {
													await update();
													isDeleting = false;
													deleteId = '';
												};
											}}
										>
											<input type="hidden" name="id" value={account.id} />
											<AlertDialog.Action
												type="submit"
												class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
											>
												{isDeleting ? 'Deleting...' : 'Delete'}
											</AlertDialog.Action>
										</form>
									</AlertDialog.Footer>
								</AlertDialog.Content>
							</AlertDialog.Root>
						</div>
					</div>
				</Card.Root>
			{/each}
		{/if}
	</div>
</div>
