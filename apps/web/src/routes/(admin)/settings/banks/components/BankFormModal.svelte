<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import * as Select from '$lib/components/ui/select';
	import FormInput from '$lib/components/forms/FormInput.svelte';
	import { api } from '$lib/services/api';
	import type { VietQRBank } from '@repo/types/shared/bank';
	import type { BankAccountRequest } from '@repo/schema/dto/bank';
	import { toast } from 'svelte-sonner';
	import { invalidateAll } from '$app/navigation';

	let { 
		open = $bindable(), 
		banks, 
		initialData,
		isEditing = false
	} = $props<{
		open: boolean;
		banks: VietQRBank[];
		initialData: { data: Partial<BankAccountRequest> };
		isEditing: boolean;
	}>();

	let bankCode = $state('');
	let accountNumber = $state('');
	let accountName = $state('');
	let isDefault = $state(false);
	let isSubmitting = $state(false);

	let selectedBank = $derived(banks.find((b: VietQRBank) => b.code === bankCode));

	// Sync initial data when editing starts
	$effect(() => {
		if (open && initialData.data) {
			bankCode = initialData.data.bankCode || '';
			accountNumber = initialData.data.accountNumber || '';
			accountName = initialData.data.accountName || '';
			isDefault = initialData.data.isDefault || false;
		}
	});

	// Reset on close
	$effect(() => {
		if (!open) {
			setTimeout(() => {
				bankCode = '';
				accountNumber = '';
				accountName = '';
				isDefault = false;
			}, 200);
		}
	});

	const accountNumberValidation = $derived.by(() => {
		if (!accountNumber) return 'default';
		if (accountNumber.length < 6) return 'error';
		if (!/^\d+$/.test(accountNumber)) return 'error';
		return 'success';
	});

	const accountNameValidation = $derived.by(() => {
		if (!accountName) return 'default';
		if (accountName !== accountName.toUpperCase()) return 'warning';
		return 'success';
	});

	async function handleSubmit() {
		if (isSubmitting) return;
		isSubmitting = true;

		try {
			const payload = {
				bankCode,
				bankName: selectedBank?.shortName ?? '',
				bankBin: selectedBank?.bin ?? '',
				accountNumber,
				accountName,
				isDefault
			};

			let result;
			if (isEditing && initialData.data?.id) {
				result = await api.v1.bank.accounts({ id: initialData.data.id }).patch(payload);
			} else {
				result = await api.v1.bank.accounts.post(payload);
			}

			if (result.error) {
				toast.error('Failed to save bank account');
			} else {
				toast.success(isEditing ? 'Bank account updated' : 'Bank account added');
				open = false;
				await invalidateAll();
			}
		} catch {
			toast.error('An error occurred');
		} finally {
			isSubmitting = false;
		}
	}
</script>

<Dialog.Root bind:open>
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
			onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}
			class="grid gap-4 py-4"
		>

			<div class="grid gap-2">
				<Label>Bank</Label>
				<Select.Root bind:value={bankCode} required>
					<Select.Trigger class="w-full">
						<Select.Value placeholder="Select a bank" />
					</Select.Trigger>
					<Select.Content>
						{#each banks as bank}
							<Select.Item value={bank.code} label="{bank.shortName} - {bank.name}" />
						{/each}
					</Select.Content>
				</Select.Root>
				{#if selectedBank}
					<div class="flex items-center gap-2 text-sm text-muted-foreground">
						<img src={selectedBank.logo} alt={selectedBank.shortName} class="h-6 w-auto" />
						<span>{selectedBank.name}</span>
					</div>
				{/if}
			</div>

			<div class="grid gap-2">
				<FormInput
					id="accountNumber"
					label="Account Number"
					type="text"
					bind:value={accountNumber}
					placeholder="e.g. 1903..."
					validationState={accountNumberValidation}
					success={accountNumberValidation === 'success' ? 'Account number looks good' : undefined}
					required
				/>
			</div>

			<div class="grid gap-2">
				<FormInput
					id="accountName"
					label="Account Name"
					type="text"
					bind:value={accountName}
					placeholder="e.g. NGUYEN VAN A"
					validationState={accountNameValidation}
					success={accountNameValidation === 'success' ? 'Account name looks good' : undefined}
					warning={accountNameValidation === 'warning' ? 'Uppercase recommended for compatibility' : undefined}
					helpText="Optional – verify in your banking app. Uppercase, no accents recommended."
				/>
			</div>

			<div class="flex items-center space-x-2">
				<input
					type="checkbox"
					id="isDefault"
					bind:checked={isDefault}
					class="h-4 w-4 rounded border-gray-300"
				/>
				<Label for="isDefault">Set as default account</Label>
			</div>

			<Dialog.Footer>
				<Button
					type="submit"
					disabled={isSubmitting}
				>
					{#if isSubmitting}
						{isEditing ? 'Updating...' : 'Adding...'}
					{:else}
						{isEditing ? 'Update Account' : 'Add Account'}
					{/if}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

