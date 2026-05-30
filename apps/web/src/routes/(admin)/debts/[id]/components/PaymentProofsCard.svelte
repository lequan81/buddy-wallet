<script lang="ts">
	import Check from '~icons/lucide/check';
import X from '~icons/lucide/x';
import Image from '~icons/lucide/image';
import FileText from '~icons/lucide/file-text';
	import * as Card from '$lib/components/ui/card';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { cn } from '$lib/utils';
	import { api } from '$lib/services/api';
	import { toast } from 'svelte-sonner';
	import { invalidateAll } from '$app/navigation';
	import type { DebtDetails } from '@repo/types/shared/debt';

	let { debt, isCreditor } = $props<{ debt: DebtDetails, isCreditor: boolean }>();

	let isSubmitting = $state<string | null>(null);

	async function handleProof(proofId: string, action: 'approve' | 'reject') {
		if (isSubmitting) return;
		isSubmitting = proofId;
		
		try {
			// Proof routes are at /v1/proof/:id/:action
			const { error } = await api.v1.proof({ id: proofId })[action].post({});
			
			if (error) {
				toast.error(`Failed to ${action} proof`);
			} else {
				toast.success(`Proof ${action}d`);
				await invalidateAll();
			}
		} catch (_e) {
			toast.error('An error occurred');
		} finally {
			isSubmitting = null;
		}
	}

	const proofs = $derived(debt.paymentProofs || []);
</script>

<Card.Root class="border-0 bg-white dark:bg-zinc-900 shadow-[0_4px_12px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.2)] rounded-lg">
	<Card.Header>
		<Card.Title class="text-sm font-medium">Payment Proofs</Card.Title>
	</Card.Header>
	<Card.Content>
		{#if proofs.length === 0}
			<div class="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
				<Image class="mb-2 h-8 w-8 opacity-20" />
				<p class="text-sm">No proofs uploaded yet</p>
			</div>
		{:else}
			<div class="grid gap-4">
				{#each proofs as proof (proof.id)}
					<div class="flex items-center justify-between rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-800/20 p-3">
						<div class="flex items-center gap-3">
							<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-50 dark:bg-zinc-800 text-zinc-650 dark:text-zinc-300">
								<FileText class="h-4.5 w-4.5" />
							</div>
							<div>
								<p class="text-xs font-medium">Payment Proof</p>
								<p class="text-[10px] text-muted-foreground">
									{new Date(proof.createdAt).toLocaleString()}
								</p>
								<div class="mt-1">
									<Badge variant={proof.status === 'approved' ? 'default' : proof.status === 'rejected' ? 'destructive' : 'secondary'} class={cn("text-[10px] h-4", proof.status === 'approved' && "bg-success hover:bg-success/80")}>
										{proof.status}
									</Badge>
								</div>
							</div>
						</div>
						
						<div class="flex items-center gap-2">
							<a class={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), "text-xs font-semibold px-3 py-1")} href={proof.url} target="_blank">
								View
							</a>
							{#if isCreditor && proof.status === 'pending'}
								<Button 
									variant="ghost" 
									size="icon" 
									class="h-8 w-8 text-destructive"
									onclick={() => handleProof(proof.id, 'reject')}
									disabled={isSubmitting === proof.id}
								>
									<X class="h-4 w-4" />
								</Button>
								<Button 
									variant="ghost" 
									size="icon" 
									class="h-8 w-8 text-success"
									onclick={() => handleProof(proof.id, 'approve')}
									disabled={isSubmitting === proof.id}
								>
									<Check class="h-4 w-4" />
								</Button>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</Card.Content>
</Card.Root>
