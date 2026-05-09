<script lang="ts">
	import { ArrowLeft, Check, X } from '@repo/icons';
	import { Button } from '@repo/ui/components/ui/button';
	import DebtStatusBadge from '$lib/components/DebtStatusBadge.svelte';
	import { api } from '$lib/services/api';
	import { toast } from 'svelte-sonner';
	import { invalidateAll } from '$app/navigation';
	import type { DebtDetails } from '@repo/types/core/debt';
	import { DEBT_STATUS } from '@repo/config/shared/status';

	let { debt, isDebtor } = $props<{ 
		debt: DebtDetails;
		isDebtor: boolean;
	}>();

	let isSubmitting = $state(false);

	async function handleAction(action: 'confirm' | 'dispute') {
		if (isSubmitting) return;
		isSubmitting = true;
		
		try {
			let error;
			if (action === 'confirm') {
				({ error } = await api.v1.debts({ id: debt.id }).confirm.post({}));
			} else {
				({ error } = await api.v1.debts({ id: debt.id }).cancel.post({ reason: 'Disputed' }));
			}

			if (error) {
				toast.error(`Failed to ${action} debt`);
			} else {
				toast.success(`Debt ${action}ed`);
				await invalidateAll();
			}
		} catch (_e) {
			toast.error('An error occurred');
		} finally {
			isSubmitting = false;
		}
	}

	const showActions = $derived(
		debt.status === DEBT_STATUS.PENDING && isDebtor
	);
</script>

<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
	<div class="flex items-center gap-4">
		<Button variant="ghost" size="icon" href="/debts" class="-ml-2">
			<ArrowLeft class="h-5 w-5" />
		</Button>
		<div>
			<div class="flex items-center gap-2">
				<h1 class="text-2xl font-bold tracking-tight">{debt.description}</h1>
				<DebtStatusBadge status={debt.status} />
			</div>
			<p class="text-sm text-muted-foreground">
				Created on {new Date(debt.createdAt).toLocaleDateString()}
			</p>
		</div>
	</div>

	{#if showActions}
		<div class="flex items-center gap-2">
			<Button
				variant="outline"
				class="border-destructive text-destructive hover:bg-destructive/10"
				onclick={() => handleAction('dispute')}
				disabled={isSubmitting}
			>
				<X class="mr-2 h-4 w-4" />
				Dispute
			</Button>
			<Button
				class="bg-success hover:bg-success/90"
				onclick={() => handleAction('confirm')}
				disabled={isSubmitting}
			>
				<Check class="mr-2 h-4 w-4" />
				Confirm
			</Button>
		</div>
	{/if}
</div>
