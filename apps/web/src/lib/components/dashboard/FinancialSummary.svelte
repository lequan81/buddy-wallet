<script lang="ts">
	import ArrowDown from '~icons/lucide/arrow-down';
import ArrowUp from '~icons/lucide/arrow-up';
import TrendingUp from '~icons/lucide/trending-up';
	import * as Card from '$lib/components/ui/card';
	import { cn } from '$lib/utils';
	import { formatCurrency } from '@repo/utils/format';

	type Props = {
		totalOwedToYou: number;
		totalYouOwe: number;
		currency?: string;
		className?: string;
	};

	let { totalOwedToYou, totalYouOwe, currency = 'VND', className }: Props = $props();

	let netBalance = $derived(totalOwedToYou - totalYouOwe);

	const getNetBalanceColor = (balance: number) => {
		if (balance > 0) return 'amount-positive';
		if (balance < 0) return 'amount-negative';
		return 'amount-neutral';
	};
</script>

<div class={cn('grid gap-4 md:grid-cols-3', className)}>
	<!-- Total Owed to You -->
	<Card.Root>
		<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
			<Card.Title class="text-sm font-medium text-muted-foreground">Owed to You</Card.Title>
			<ArrowUp class="h-4 w-4 text-success" />
		</Card.Header>
		<Card.Content>
			<div class="space-y-1">
				<div class="font-tabular text-3xl font-bold text-success">
					{formatCurrency(totalOwedToYou)}
				</div>
				<p class="text-xs text-muted-foreground">You will receive</p>
			</div>
		</Card.Content>
	</Card.Root>

	<!-- Total You Owe -->
	<Card.Root>
		<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
			<Card.Title class="text-sm font-medium text-muted-foreground">You Owe</Card.Title>
			<ArrowDown class="h-4 w-4 text-destructive" />
		</Card.Header>
		<Card.Content>
			<div class="space-y-1">
				<div class="font-tabular text-3xl font-bold text-destructive">
					{formatCurrency(totalYouOwe)}
				</div>
				<p class="text-xs text-muted-foreground">You need to pay</p>
			</div>
		</Card.Content>
	</Card.Root>

	<!-- Net Balance -->
	<Card.Root>
		<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
			<Card.Title class="text-sm font-medium text-muted-foreground">Net Balance</Card.Title>
			<TrendingUp class="h-4 w-4 text-muted-foreground" />
		</Card.Header>
		<Card.Content>
			<div class="space-y-1">
				<div class={cn('font-tabular text-3xl font-bold', getNetBalanceColor(netBalance))}>
					{formatCurrency(Math.abs(netBalance))}
				</div>
				<p class="text-xs text-muted-foreground">
					{#if netBalance > 0}
						You're owed more
					{:else if netBalance < 0}
						You owe more
					{:else}
						All settled
					{/if}
				</p>
			</div>
		</Card.Content>
	</Card.Root>
</div>
