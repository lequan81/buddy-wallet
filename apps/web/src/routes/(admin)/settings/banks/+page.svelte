<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '@repo/ui/components/ui/button';
	import { Input } from '@repo/ui/components/ui/input';
	import { Label } from '@repo/ui/components/ui/label';
	import * as Card from '@repo/ui/components/ui/card';
	import { Separator } from '@repo/ui/components/ui/separator';
	import { Plus, Trash2, Landmark } from '@lucide/svelte';
	import * as Dialog from '@repo/ui/components/ui/dialog';

	let { data, form } = $props();

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
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h3 class="text-lg font-medium">Bank Accounts</h3>
			<p class="text-sm text-muted-foreground">Manage your bank accounts for receiving payments.</p>
		</div>
		<Dialog.Root open={isAdding} onOpenChange={(open: boolean) => (isAdding = open)}>
			<Dialog.Trigger>
				<Button size="sm">
					<Plus class="mr-2 h-4 w-4" />
					Add Account
				</Button>
			</Dialog.Trigger>
			<Dialog.Content class="sm:max-w-md">
				<Dialog.Header>
					<Dialog.Title>Add Bank Account</Dialog.Title>
					<Dialog.Description>
						Enter your bank details to receive payments via VietQR.
					</Dialog.Description>
				</Dialog.Header>

				<form
					method="POST"
					action="?/add"
					use:enhance={() => {
						isSubmitting = true;
						return async ({ update, result }) => {
							await update();
							isSubmitting = false;
							if (result.type === 'success') {
								isAdding = false;
								selectedBankCode = '';
							}
						};
					}}
					class="grid gap-4 py-4"
				>
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
						<Label for="accountNumber">Account Number</Label>
						<Input id="accountNumber" name="accountNumber" required placeholder="e.g. 1903..." />
					</div>

					<div class="grid gap-2">
						<Label for="accountName">Account Name</Label>
						<Input id="accountName" name="accountName" required placeholder="e.g. NGUYEN VAN A" />
						<p class="text-[0.8rem] text-muted-foreground">
							Name registered with the bank (uppercase, no accents recommended).
						</p>
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
						<Button type="submit" disabled={isSubmitting || !selectedBankCode}>
							{isSubmitting ? 'Adding...' : 'Add Account'}
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
									{account.accountNumber} • {account.accountName}
								</p>
							</div>
						</div>
						<form
							method="POST"
							action="?/delete"
							use:enhance={() => {
								return async ({ update }) => {
									await update();
								};
							}}
						>
							<input type="hidden" name="id" value={account.id} />
							<Button
								variant="ghost"
								size="icon"
								class="text-muted-foreground hover:text-destructive"
							>
								<Trash2 class="h-4 w-4" />
							</Button>
						</form>
					</div>
				</Card.Root>
			{/each}
		{/if}
	</div>
</div>
