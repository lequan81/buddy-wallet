<script lang="ts">
	import PageContainer from '$lib/components/layout/PageContainer.svelte';
	import { Separator } from '@repo/ui/components/ui/separator';
	import { Button } from '@repo/ui/components/ui/button';
	import type { PageData } from './$types';
	
	// Sub-components
	import DebtHeader from './components/DebtHeader.svelte';
	import DebtDetailsCard from './components/DebtDetailsCard.svelte';
	import PaymentProofsCard from './components/PaymentProofsCard.svelte';
	import ProofUploadCard from './components/ProofUploadCard.svelte';
	import DebtSuggestionsCard from './components/DebtSuggestionsCard.svelte';
	import DebtTimeline from './components/DebtTimeline.svelte';
	import DebtActionModals from './components/DebtActionModals.svelte';

	let { data }: { data: PageData } = $props();

	// Computed states for child components
	const debt = $derived(data.debt);
	const isCreditor = $derived(data.isCreditor);
	const isDebtor = $derived(data.isDebtor);

	// Modal states
	let openMarkPaid = $state(false);
	let openEdit = $state(false);
	let openSuggest = $state(false);

	function handleEdit() {
		if (isCreditor) openEdit = true;
		else if (isDebtor) openSuggest = true;
	}
</script>

<PageContainer>
	{#if !debt}
		<div class="flex flex-col items-center justify-center py-20 text-center">
			<h1 class="text-2xl font-bold tracking-tight text-destructive">Debt Not Found</h1>
			<p class="text-muted-foreground mt-2">{data.error || 'The debt record you requested could not be located.'}</p>
			<a href="/debts" class="mt-6 text-sm font-medium text-primary hover:underline">
				Back to my debts
			</a>
		</div>
	{:else}
		<DebtHeader {debt} isDebtor={isDebtor || false} />
		
		<Separator class="my-6" />

		<div class="grid gap-8 lg:grid-cols-3">
			<!-- Main Content -->
			<div class="lg:col-span-2 space-y-8">
				<DebtDetailsCard {debt} isCreditor={isCreditor || false} onEdit={handleEdit} />
				
				<div class="grid gap-8 sm:grid-cols-2">
					<PaymentProofsCard {debt} isCreditor={isCreditor || false} />
					{#if isDebtor && debt.status !== 'paid' && debt.status !== 'cancelled'}
						<ProofUploadCard {debt} />
					{/if}
				</div>

				<DebtSuggestionsCard {debt} isCreditor={isCreditor || false} isDebtor={isDebtor || false} />
			</div>

			<!-- Sidebar -->
			<div class="space-y-8">
				<DebtTimeline {debt} />
				
				{#if isCreditor && debt.status === 'confirmed'}
					<div class="rounded-lg border bg-primary/5 p-4 space-y-3">
						<h4 class="text-xs font-bold uppercase tracking-wider text-primary">Creditor Actions</h4>
						<p class="text-xs text-muted-foreground">Once you verify payment has been received, mark it as paid.</p>
						<Button class="w-full bg-success hover:bg-success/90" onclick={() => openMarkPaid = true}>
							Mark as Paid
						</Button>
					</div>
				{/if}
			</div>
		</div>

		<DebtActionModals
			{debt}
			bind:openMarkPaid
			bind:openEdit
			bind:openSuggest
		/>
	{/if}
</PageContainer>
