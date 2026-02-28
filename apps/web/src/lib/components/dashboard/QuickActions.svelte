<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '@repo/ui/components/ui/button';
	import * as Card from '@repo/ui/components/ui/card';
	import { Badge } from '@repo/ui/components/ui/badge';
	import { cn } from '$lib/utils';
	import IconLucidePlus from '~icons/lucide/plus';
	import IconLucideUsers from '~icons/lucide/users';
	import IconLucideClock from '~icons/lucide/clock';
	import IconLucideFileSpreadsheet from '~icons/lucide/file-spreadsheet';

	interface QuickDebt {
		description: string;
		amount: string;
		phone?: string;
		email?: string;
		createdAt?: string;
	}

	let recentDebts = $state<QuickDebt[]>([]);
	let isLoading = $state(true);
	let hasChecked = $state(false);

	onMount(() => {
		loadRecentDebts();
	});

	async function loadRecentDebts() {
		if (hasChecked) return;
		hasChecked = true;
		
		isLoading = true;
		try {
			const response = await fetch('/v1/debts/recent');
			if (response.ok) {
				const data = await response.json();
				recentDebts = data.debts || [];
			}
		} catch (error) {
			console.error('Failed to load recent debts:', error);
		} finally {
			isLoading = false;
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

<!-- Quick Actions Section -->
<Card.Root class="mb-6">
	<Card.Header>
		<Card.Title class="flex items-center gap-2">
			<IconLucidePlus class="h-5 w-5" />
			Quick Actions
		</Card.Title>
		<Card.Description>
			Fast access to common debt entries and recent activity
		</Card.Description>
	</Card.Header>
	<Card.Content>
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
			<!-- Quick Debt Templates -->
			<div class="lg:col-span-3">
				<h3 class="font-medium mb-3">Quick Debt Templates</h3>
				<div class="grid grid-cols-2 md:grid-cols-4 gap-3">
					<!-- Lunch Money -->
					<button
						type="button"
						class="p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer text-center" 
						onclick={() => createQuickDebt({ description: 'Lunch money', amount: '150000' })}
					>
						<div class="text-2xl mb-2">🍱</div>
						<div class="text-sm font-medium">Lunch</div>
						<div class="text-xs text-muted-foreground">150K</div>
					</button>
					
					<!-- Coffee -->
					<button
						type="button"
						class="p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer text-center" 
						onclick={() => createQuickDebt({ description: 'Coffee break', amount: '50000' })}
					>
						<div class="text-2xl mb-2">☕</div>
						<div class="text-sm font-medium">Coffee</div>
						<div class="text-xs text-muted-foreground">50K</div>
					</button>
					
					<!-- Taxi -->
					<button
						type="button"
						class="p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer text-center" 
						onclick={() => createQuickDebt({ description: 'Taxi/Grab', amount: '80000' })}
					>
						<div class="text-2xl mb-2">🚗</div>
						<div class="text-sm font-medium">Taxi</div>
						<div class="text-xs text-muted-foreground">80K</div>
					</button>
					
					<!-- Utilities -->
					<button
						type="button"
						class="p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer text-center" 
						onclick={() => createQuickDebt({ description: 'House utilities', amount: '200000' })}
					>
						<div class="text-2xl mb-2">💡</div>
						<div class="text-sm font-medium">Utilities</div>
						<div class="text-xs text-muted-foreground">200K</div>
					</button>
				</div>
			</div>
			
			<!-- Quick Links -->
			<div>
				<h3 class="font-medium mb-3">Quick Links</h3>
				<div class="space-y-2">
					<Button href="/debts/create" class="w-full justify-start" variant="outline">
						<IconLucidePlus class="h-4 w-4 mr-2" />
						Create New Debt
					</Button>
					<Button href="/dashboard/import" class="w-full justify-start" variant="outline">
						<IconLucideFileSpreadsheet class="h-4 w-4 mr-2" />
						Import Debts
					</Button>
				</div>
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
				<p>No recent debt activity</p>
				<Button href="/debts/create" class="mt-4">
					Create Your First Debt
				</Button>
			</div>
		{:else}
			<div class="space-y-4">
				{#each recentDebts as debt}
					<button
						type="button"
						class="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors w-full text-left"
						onclick={() => window.location.href = `/debts/create?description=${encodeURIComponent(debt.description)}&amount=${debt.amount}${debt.phone ? `&phone=${debt.phone}` : ''}${debt.email ? `&email=${debt.email}` : ''}`}
					>
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
								{#if debt.createdAt}
									{formatDate(debt.createdAt)}
								{:else}
									Recent
								{/if}
							</div>
						</div>
					</button>
				{/each}
			</div>
		{/if}
	</Card.Content>
</Card.Root>

<style>
	:global(.capitalize) {
		text-transform: capitalize;
	}
</style>
