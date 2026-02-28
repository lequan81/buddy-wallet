<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '@repo/ui/components/ui/button';
	import * as Card from '@repo/ui/components/ui/card';
	import { Badge } from '@repo/ui/components/ui/badge';
	import { cn } from '$lib/utils';
	import IconLucideArrowLeft from '~icons/lucide/arrow-left';
	import IconLucidePlus from '~icons/lucide/plus';
	import IconLucideUsers from '~icons/lucide/users';
	import IconLucideClock from '~icons/lucide/clock';
	import IconLucideCalendar from '~icons/lucide/calendar';

	interface QuickDebt {
		description: string;
		amount: string;
		phone?: string;
		email?: string;
	}

	let { data } = $props();
	let recentDebts: QuickDebt[] = [];
	let isLoading = $state(false);

	onMount(async () => {
		await loadRecentDebts();
	});

	async function loadRecentDebts() {
		try {
			const response = await fetch('/v1/debts/recent');
			if (response.ok) {
				const data = await response.json();
				recentDebts = data.debts || [];
			}
		} catch (error) {
			console.error('Failed to load recent debts:', error);
		}
	}

	function createQuickDebt(debt: QuickDebt) {
		// Navigate to create debt page with pre-filled data
		const params = new URLSearchParams();
		if (debt.description) params.set('description', debt.description);
		if (debt.amount) params.set('amount', debt.amount);
		if (debt.phone) params.set('phone', debt.phone);
		if (debt.email) params.set('email', debt.email);
		
		window.location.href = `/debts/create?${params.toString()}`;
	}

	function formatDate(dateStr: string) {
		return new Date(dateStr).toLocaleDateString();
	}
</script>

<div class="container max-w-4xl mx-auto py-8">
	<div class="flex items-center justify-between mb-6">
		<div>
			<h1 class="text-2xl font-bold">Quick Actions</h1>
			<p class="text-muted-foreground">Common debt entries and recent activity</p>
		</div>
		<Button href="/debts/create" variant="outline">
			<IconLucidePlus class="h-4 w-4 mr-2" />
			Create New Debt
		</Button>
	</div>

	<!-- Quick Debt Templates -->
	<Card.Root class="mb-6">
		<Card.Header>
			<Card.Title class="flex items-center gap-2">
				<IconLucideUsers class="h-5 w-5" />
				Quick Debt Templates
			</Card.Title>
			<Card.Description>
				Common debt entries for frequently used scenarios
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				<!-- Lunch Money -->
				<div class="p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer" 
					 on:click={() => createQuickDebt({ description: 'Lunch money', amount: '150000' })}>
					<div class="text-center mb-2">
						<div class="text-2xl font-bold text-primary">🍱</div>
						<div class="font-medium">Lunch Money</div>
					</div>
					<div class="text-sm text-muted-foreground">Quick entry for shared meals</div>
				</div>
				
				<!-- Coffee Break -->
				<div class="p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer" 
					 on:click={() => createQuickDebt({ description: 'Coffee break', amount: '50000' })}>
					<div class="text-center mb-2">
						<div class="text-2xl font-bold text-primary">☕</div>
						<div class="font-medium">Coffee Break</div>
					</div>
					<div class="text-sm text-muted-foreground">Office coffee run</div>
				</div>
				
				<!-- Taxi/Grab -->
				<div class="p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer" 
					 on:click={() => createQuickDebt({ description: 'Taxi/Grab', amount: '80000' })}>
					<div class="text-center mb-2">
						<div class="text-2xl font-bold text-primary">🚗</div>
						<div class="font-medium">Taxi/Grab</div>
					</div>
					<div class="text-sm text-muted-foreground">Transportation costs</div>
				</div>
				
				<!-- Utilities -->
				<div class="p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer" 
					 on:click={() => createQuickDebt({ description: 'House utilities', amount: '200000' })}>
					<div class="text-center mb-2">
						<div class="text-2xl font-bold text-primary">💡</div>
						<div class="font-medium">House Utilities</div>
					</div>
					<div class="text-sm text-muted-foreground">Monthly shared expenses</div>
				</div>
			</div>
		</Card.Content>
	</Card.Root>

	<!-- Recent Activity -->
	<Card.Root>
		<Card.Header>
			<Card.Title class="flex items-center gap-2">
				<IconLucideClock class="h-5 w-5" />
				Recent Debt Activity
			</Card.Title>
			<Card.Description>
				Your recently created or updated debts
			</Card.Description>
		</Card.Header>
		<Card.Content>
			{#if recentDebts.length === 0}
				<div class="text-center py-8 text-muted-foreground">
					<IconLucideCalendar class="h-12 w-12 mx-auto mb-4 opacity-50" />
					<p>No recent debt activity</p>
					<Button href="/debts/create" class="mt-4">
						Create Your First Debt
					</Button>
				</div>
			{:else}
				<div class="space-y-4">
					{#each recentDebts as debt}
						<div class="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
							<div class="flex-1">
								<div class="font-medium">{debt.description}</div>
								<div class="text-sm text-muted-foreground">
									{#if debt.phone}
										Phone: {debt.phone}
									{:else if debt.email}
										Email: {debt.email}
									{/if}
								</div>
							</div>
							<div class="text-right">
								<div class="text-lg font-bold">
									{new Intl.NumberFormat('vi-VN', {
										style: 'currency',
										currency: 'VND'
									}).format(parseInt(debt.amount))}
								</div>
								<div class="text-sm text-muted-foreground">
									{formatDate(debt.createdAt)}
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</Card.Content>
	</Card.Root>
</div>

<style>
	:global(.capitalize) {
		text-transform: capitalize;
	}
</style>
