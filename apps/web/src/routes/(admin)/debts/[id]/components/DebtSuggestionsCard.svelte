<script lang="ts">
	import { Check, X, Clock } from '@repo/icons';
	import * as Card from '@repo/ui/components/ui/card';
	import { Button } from '@repo/ui/components/ui/button';
	import { Badge } from '@repo/ui/components/ui/badge';
	import { formatCurrency } from '@repo/utils/format';
	import { api } from '$lib/services/api';
	import { toast } from 'svelte-sonner';
	import { invalidateAll } from '$app/navigation';
	import type { DebtDetails } from '@repo/types/shared/debt';

	let { debt, isCreditor, isDebtor } = $props<{ 
		debt: DebtDetails;
		isCreditor: boolean;
		isDebtor: boolean;
	}>();

	let isSubmitting = $state(false);

	async function handleSuggestion(accept: boolean) {
		if (isSubmitting) return;
		isSubmitting = true;
		
		try {
			const { error } = await api.v1.debts({ id: debt.id }).suggestion.respond.post({ accept });
			
			if (error) {
				toast.error(`Failed to ${accept ? 'approve' : 'reject'} suggestion`);
			} else {
				toast.success(`Suggestion ${accept ? 'approved' : 'rejected'}`);
				await invalidateAll();
			}
		} catch (_e) {
			toast.error('An error occurred');
		} finally {
			isSubmitting = false;
		}
	}

	const hasSuggestion = $derived(debt.suggestedAmount != null || debt.suggestedDescription != null);
	const suggestionDate = $derived(debt.suggestedAt ? new Date(debt.suggestedAt).toLocaleString() : '');
</script>

<Card.Root>
	<Card.Header>
		<Card.Title class="text-sm font-medium">Edit Suggestions</Card.Title>
	</Card.Header>
	<Card.Content>
		{#if !hasSuggestion}
			<div class="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
				<Clock class="mb-2 h-8 w-8 opacity-20" />
				<p class="text-sm">No suggestions yet</p>
			</div>
		{:else}
			<div class="grid gap-4">
				<div class="flex flex-col gap-3 rounded-lg border p-4">
					<div class="flex items-center justify-between">
						<Badge variant="default" class="bg-warning hover:bg-warning/80">
							pending
						</Badge>
						<span class="text-[10px] text-muted-foreground">
							{suggestionDate}
						</span>
					</div>
					
					<div class="grid grid-cols-2 gap-4 text-xs">
						<div class="space-y-1">
							<p class="text-muted-foreground">Proposed Amount</p>
							<p class="font-medium">
								{#if debt.suggestedAmount != null}
									{formatCurrency(debt.suggestedAmount, debt.currency)}
								{:else}
									Unchanged
								{/if}
							</p>
						</div>
						<div class="space-y-1">
							<p class="text-muted-foreground">Proposed Description</p>
							<p class="font-medium">{debt.suggestedDescription || 'Unchanged'}</p>
						</div>
					</div>

					{#if ((debt.suggestedById === debt.debtorId && isCreditor) || (debt.suggestedById === debt.creditorId && isDebtor))}
						<div class="flex items-center gap-2 pt-2">
							<Button 
								variant="outline" 
								size="sm" 
								class="flex-1 text-destructive border-destructive hover:bg-destructive/10"
								onclick={() => handleSuggestion(false)}
								disabled={isSubmitting}
							>
								<X class="mr-2 h-3 w-3" />
								Reject
							</Button>
							<Button 
								size="sm" 
								class="flex-1 bg-success hover:bg-success/90"
								onclick={() => handleSuggestion(true)}
								disabled={isSubmitting}
							>
								<Check class="mr-2 h-3 w-3" />
								Approve
							</Button>
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</Card.Content>
</Card.Root>
