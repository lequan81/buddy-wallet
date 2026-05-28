<script lang="ts">
	import Plus from '~icons/lucide/plus';
	import { Button } from '$lib/components/ui/button';
	import PageContainer from '$lib/components/layout/PageContainer.svelte';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import type { PageData } from './$types';
	import type { BankAccount, VietQRBank } from '@repo/types/shared/bank';
	import type { BankAccountRequest } from '@repo/schema/dto/bank';
	
	// Sub-components
	import BankAccountsList from './components/BankAccountsList.svelte';
	import BankFormModal from './components/BankFormModal.svelte';

	let { data }: { data: PageData } = $props();

	// Provide fallback array to avoid undefined errors
	let accounts = $derived((data.accounts || []) as BankAccount[]);
	let banks = $derived((data.banks || []) as VietQRBank[]);

	// Modal states
	let isModalOpen = $state(false);
	let isEditing = $state(false);
	
	// Initialize with empty data
	let editingData = $state<{ data: Partial<BankAccountRequest> }>({ 
		data: {
			bankCode: '',
			bankName: '',
			bankBin: '',
			accountNumber: '',
			accountName: '',
			isDefault: false
		}
	});

	function openAddModal() {
		isEditing = false;
		editingData = { data: {} };
		isModalOpen = true;
	}

	function openEditModal(account: BankAccount) {
		isEditing = true;
		const initial: BankAccountRequest = {
			id: account.id,
			bankCode: '', // Will be matched by bin in modal
			bankName: account.bankName,
			bankBin: account.bankBin,
			accountNumber: account.accountNumber,
			accountName: account.accountName || '',
			isDefault: account.isDefault || false
		};
		
		// Find bank code
		const bank = banks.find(b => b.bin === account.bankBin);
		if (bank) {
			initial.bankCode = bank.code;
		}
		
		editingData = { data: initial };
		isModalOpen = true;
	}
</script>

<PageContainer>
	<PageHeader 
		title="Bank Accounts" 
		description="Manage your bank accounts for receiving payments."
	>
		{#snippet actions()}
			<Button size="sm" onclick={openAddModal}>
				<Plus class="mr-2 h-4 w-4" />
				Add Account
			</Button>
		{/snippet}
	</PageHeader>

	<div class="space-y-6">
		<BankAccountsList {accounts} onEdit={openEditModal} />
	</div>

	<BankFormModal 
		bind:open={isModalOpen} 
		{banks} 
		initialData={editingData} 
		{isEditing} 
	/>
</PageContainer>

