<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { Button } from '@repo/ui/components/ui/button';
	import FormInput from '$lib/components/forms/FormInput.svelte';
	import { updateDebt, suggestEdit } from '$lib/remotes/debts.remote';
	import { api } from '$lib/services/api';
	import { toast } from 'svelte-sonner';
	import { invalidateAll } from '$app/navigation';
	import type { DebtDetails } from '@repo/types/core/debt';

	let { 
		debt,
		openMarkPaid = $bindable(false),
		openEdit = $bindable(false),
		openSuggest = $bindable(false)
	} = $props<{
		debt: DebtDetails;
		openMarkPaid: boolean;
		openEdit: boolean;
		openSuggest: boolean;
	}>();

	let isSubmitting = $state(false);

	// Edit form state
	// svelte-ignore state_referenced_locally
	let editDescription = $state(debt.description ?? '');
	// svelte-ignore state_referenced_locally
	let editAmount = $state(debt.amount?.toString() ?? '');

	// Suggest form state
	let suggestAmount = $state('');
	let suggestDescription = $state('');
	let suggestNote = $state('');

	// Sync debt data when edit modal opens
	$effect(() => {
		if (openEdit) {
			editDescription = debt.description ?? '';
			editAmount = debt.amount?.toString() ?? '';
		}
	});

	// Reset suggest form when modal opens
	$effect(() => {
		if (openSuggest) {
			suggestAmount = '';
			suggestDescription = '';
			suggestNote = '';
		}
	});

	async function handleMarkAsPaid() {
		if (isSubmitting) return;
		isSubmitting = true;
		try {
			const { error } = await api.v1.debts({ id: debt.id }).complete.post({});
			if (error) {
				toast.error('Failed to mark debt as paid');
			} else {
				toast.success('Debt marked as paid');
				openMarkPaid = false;
				await invalidateAll();
			}
		} catch (_e) {
			toast.error('An error occurred');
		} finally {
			isSubmitting = false;
		}
	}
</script>

<!-- Mark as Paid Dialog -->
<AlertDialog.Root bind:open={openMarkPaid}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Mark this debt as paid?</AlertDialog.Title>
			<AlertDialog.Description>
				This will permanently mark the debt as settled. Ensure you have received the payment.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<Button variant="default" class="bg-success hover:bg-success/90" onclick={handleMarkAsPaid} disabled={isSubmitting}>
				{isSubmitting ? 'Processing...' : 'Confirm Payment'}
			</Button>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<!-- Edit Debt Dialog (Creditor) -->
<Dialog.Root bind:open={openEdit}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Edit Debt</Dialog.Title>
			<Dialog.Description>Modify the debt amount or description.</Dialog.Description>
		</Dialog.Header>
		<form
			{...updateDebt.enhance(async ({ submit }) => {
				isSubmitting = true;
				try {
					await submit();
					toast.success('Debt updated successfully');
					openEdit = false;
					await invalidateAll();
				} finally {
					isSubmitting = false;
				}
			})}
			class="space-y-4 py-4"
		>
			<FormInput
				label="Description"
				name="description"
				bind:value={editDescription}
				required
			/>
			<FormInput
				label="Amount"
				name="amount"
				type="number"
				bind:value={editAmount}
				required
			/>
			<Dialog.Footer>
				<Button type="submit" disabled={isSubmitting}>
					{isSubmitting ? 'Saving...' : 'Save Changes'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<!-- Suggest Edit Dialog (Debtor) -->
<Dialog.Root bind:open={openSuggest}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Suggest Changes</Dialog.Title>
			<Dialog.Description>Propose a different amount or description to the creditor.</Dialog.Description>
		</Dialog.Header>
		<form
			{...suggestEdit.enhance(async ({ submit }) => {
				isSubmitting = true;
				try {
					await submit();
					toast.success('Suggestion sent to creditor');
					openSuggest = false;
					await invalidateAll();
				} finally {
					isSubmitting = false;
				}
			})}
			class="space-y-4 py-4"
		>
			<FormInput
				label="Proposed Amount"
				name="amount"
				type="number"
				bind:value={suggestAmount}
				required
			/>
			<FormInput
				label="Proposed Description"
				name="description"
				bind:value={suggestDescription}
				required
			/>
			<FormInput
				label="Note to Creditor"
				name="note"
				placeholder="Explain why you are suggesting this change..."
				bind:value={suggestNote}
			/>
			<Dialog.Footer>
				<Button type="submit" disabled={isSubmitting}>
					{isSubmitting ? 'Sending...' : 'Send Suggestion'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
