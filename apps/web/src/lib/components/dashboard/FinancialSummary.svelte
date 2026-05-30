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
	<Card.Root class="overflow-hidden border-0 bg-white dark:bg-zinc-900 shadow-[0_4px_12px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.2)] rounded-lg transition-all duration-200 hover:shadow-[0_6px_20px_rgba(0,0,0,0.05)] dark:hover:shadow-[0_6px_20px_rgba(0,0,0,0.3)]">
		<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2.5 pt-4 px-4">
			<Card.Title class="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 flex items-center gap-1.5">
				<span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
				Owed to You
			</Card.Title>
			<div class="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-50 text-zinc-400 dark:bg-zinc-800/60 dark:text-zinc-500">
				<ArrowUp class="h-3.5 w-3.5" />
			</div>
		</Card.Header>
		<Card.Content class="pb-4 pt-0 px-4">
			<div class="space-y-0.5">
				<div class="font-tabular text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
					{formatCurrency(totalOwedToYou)}
				</div>
				<p class="text-[10px] font-medium text-zinc-400/90">You will receive</p>
			</div>
		</Card.Content>
	</Card.Root>

	<!-- Total You Owe -->
	<Card.Root class="overflow-hidden border-0 bg-white dark:bg-zinc-900 shadow-[0_4px_12px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.2)] rounded-lg transition-all duration-200 hover:shadow-[0_6px_20px_rgba(0,0,0,0.05)] dark:hover:shadow-[0_6px_20px_rgba(0,0,0,0.3)]">
		<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2.5 pt-4 px-4">
			<Card.Title class="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 flex items-center gap-1.5">
				<span class="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
				You Owe
			</Card.Title>
			<div class="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-50 text-zinc-400 dark:bg-zinc-800/60 dark:text-zinc-500">
				<ArrowDown class="h-3.5 w-3.5" />
			</div>
		</Card.Header>
		<Card.Content class="pb-4 pt-0 px-4">
			<div class="space-y-0.5">
				<div class="font-tabular text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
					{formatCurrency(totalYouOwe)}
				</div>
				<p class="text-[10px] font-medium text-zinc-400/90">You need to pay</p>
			</div>
		</Card.Content>
	</Card.Root>

	<!-- Net Balance -->
	<Card.Root class="overflow-hidden border-0 bg-white dark:bg-zinc-900 shadow-[0_4px_12px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.2)] rounded-lg transition-all duration-200 hover:shadow-[0_6px_20px_rgba(0,0,0,0.05)] dark:hover:shadow-[0_6px_20px_rgba(0,0,0,0.3)]">
		<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2.5 pt-4 px-4">
			<Card.Title class="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 flex items-center gap-1.5">
				<span class={cn(
					"h-1.5 w-1.5 rounded-full",
					netBalance > 0 
						? "bg-emerald-500"
						: netBalance < 0
							? "bg-rose-500"
							: "bg-zinc-300 dark:bg-zinc-650"
				)}></span>
				Net Balance
			</Card.Title>
			<div class="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-50 text-zinc-400 dark:bg-zinc-800/60 dark:text-zinc-500">
				<TrendingUp class="h-3.5 w-3.5" />
			</div>
		</Card.Header>
		<Card.Content class="pb-4 pt-0 px-4">
			<div class="space-y-0.5">
				<div class="font-tabular text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
					{formatCurrency(Math.abs(netBalance))}
				</div>
				<p class="text-[10px] font-medium text-zinc-400/90">
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
