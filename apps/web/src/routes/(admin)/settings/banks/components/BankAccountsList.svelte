<script lang="ts">
	import Landmark from '~icons/lucide/landmark';
import Pencil from '~icons/lucide/pencil';
import Trash2 from '~icons/lucide/trash-2';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { toast } from 'svelte-sonner';
	import { invalidateAll } from '$app/navigation';
	import type { BankAccount } from '@repo/types/shared/bank';
	import { api } from '$lib/services/api';

	let { accounts, onEdit }: { accounts: BankAccount[], onEdit: (account: BankAccount) => void } = $props();

	let deleteId = $state('');
	let isDeleting = $state(false);

	async function handleDelete(id: string) {
		if (isDeleting) return;
		isDeleting = true;
		try {
			const { error } = await api.v1.bank.accounts({ id }).delete();
			if (error) {
				toast.error('Failed to delete bank account');
			} else {
				toast.success('Bank account deleted');
				deleteId = '';
				await invalidateAll();
			}
		} catch {
			toast.error('Failed to delete bank account');
		} finally {
			isDeleting = false;
		}
	}
</script>

<div class="space-y-4">
	{#if accounts.length === 0}
		<div
			class="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 p-8 text-center text-muted-foreground bg-zinc-50/10 dark:bg-zinc-950/10"
		>
			<Landmark class="mb-4 h-8 w-8 opacity-50" />
			<p>No bank accounts added yet.</p>
			<p class="text-sm">Add an account to easier receive payments.</p>
		</div>
	{:else}
		{#each accounts as account (account.id)}
			<Card.Root class="border-0 bg-white dark:bg-zinc-900 shadow-[0_4px_12px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.2)] rounded-lg">
				<div class="flex items-center justify-between p-6">
					<div class="flex items-center gap-4">
						<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-350">
							<Landmark class="h-4.5 w-4.5" />
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
								{account.accountNumber} • {account.accountName}
							</p>
						</div>
					</div>
					<div class="flex items-center gap-1">
						<Button
							variant="ghost"
							size="icon"
							class="text-muted-foreground hover:text-foreground"
							onclick={() => onEdit(account)}
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
								{#snippet child({ props }: { props: Record<string, unknown> })}
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
									<Button
										type="button"
										variant="destructive"
										disabled={isDeleting}
										onclick={() => handleDelete(account.id)}
									>
										{isDeleting ? 'Deleting...' : 'Delete'}
									</Button>
								</AlertDialog.Footer>
							</AlertDialog.Content>
						</AlertDialog.Root>
					</div>
				</div>
			</Card.Root>
		{/each}
	{/if}
</div>

