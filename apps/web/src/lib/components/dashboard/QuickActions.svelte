<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import Plus from '~icons/lucide/plus';
import Clock from '~icons/lucide/clock';
import FileSpreadsheet from '~icons/lucide/file-spreadsheet';
	import { formatDate } from '@repo/utils/format';

	interface RecentDebtItem {
		id: string;
		description: string | null;
		amount: number | string;
		createdAt: string | Date | null;
		phone?: string;
		counterpartyPhone?: string;
		counterpartyName?: string;
	}

	interface QuickDebtTemplate {
		description: string;
		amount: string;
		phone?: string;
		email?: string;
	}

	let { onOpenModal, recentDebts = [] } = $props<{
		onOpenModal: (data: Partial<QuickDebtTemplate>) => void;
		recentDebts?: RecentDebtItem[];
	}>();

	function createQuickDebt(debt: QuickDebtTemplate) {
		onOpenModal(debt);
	}

</script>

<!-- Quick Actions Section -->
<Card.Root class="mb-6 border-0 bg-white dark:bg-zinc-900 shadow-[0_4px_12px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.2)] rounded-lg">
	<Card.Header class="pb-3.5 pt-4 px-4">
		<Card.Title class="flex items-center gap-2 text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
			<Plus class="h-4 w-4 text-zinc-400" />
			Quick Actions
		</Card.Title>
		<Card.Description class="text-[10px] text-zinc-400 mt-0.5">
			Fast access to common debt entries and recent activity
		</Card.Description>
	</Card.Header>
	<Card.Content class="pb-4 pt-0 px-4">
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
			<!-- Quick Debt Templates -->
			<div class="lg:col-span-3">
				<h3 class="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-3">Quick Debt Templates</h3>
				<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
					<!-- Lunch Money -->
					<button
						type="button"
						class="group p-3 border border-zinc-100 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-850 transition-colors duration-200 cursor-pointer text-center" 
						onclick={() => createQuickDebt({ description: 'Lunch money', amount: '150000' })}
					>
						<div class="flex items-center justify-center w-9 h-9 mx-auto mb-2 rounded-full border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-850/50 text-base">🍱</div>
						<div class="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Lunch</div>
						<div class="text-[10px] font-bold text-zinc-500 mt-0.5">150,000 ₫</div>
					</button>
					
					<!-- Coffee -->
					<button
						type="button"
						class="group p-3 border border-zinc-100 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-850 transition-colors duration-200 cursor-pointer text-center" 
						onclick={() => createQuickDebt({ description: 'Coffee break', amount: '50000' })}
					>
						<div class="flex items-center justify-center w-9 h-9 mx-auto mb-2 rounded-full border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-850/50 text-base">☕</div>
						<div class="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Coffee</div>
						<div class="text-[10px] font-bold text-zinc-500 mt-0.5">50,000 ₫</div>
					</button>
					
					<!-- Taxi -->
					<button
						type="button"
						class="group p-3 border border-zinc-100 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-850 transition-colors duration-200 cursor-pointer text-center" 
						onclick={() => createQuickDebt({ description: 'Taxi/Grab', amount: '80000' })}
					>
						<div class="flex items-center justify-center w-9 h-9 mx-auto mb-2 rounded-full border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-850/50 text-base">🚗</div>
						<div class="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Taxi</div>
						<div class="text-[10px] font-bold text-zinc-500 mt-0.5">80,000 ₫</div>
					</button>
					
					<!-- Utilities -->
					<button
						type="button"
						class="group p-3 border border-zinc-100 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-850 transition-colors duration-200 cursor-pointer text-center" 
						onclick={() => createQuickDebt({ description: 'House utilities', amount: '200000' })}
					>
						<div class="flex items-center justify-center w-9 h-9 mx-auto mb-2 rounded-full border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-850/50 text-base">💡</div>
						<div class="text-xs font-semibold text-zinc-800 dark:text-zinc-200">Utilities</div>
						<div class="text-[10px] font-bold text-zinc-500 mt-0.5">200,000 ₫</div>
					</button>
				</div>
			</div>
			
			<!-- Quick Links -->
			<div class="flex flex-col">
				<h3 class="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-3">Quick Links</h3>
				<div class="flex-1 space-y-2 flex flex-col justify-start">
					<Button onclick={() => onOpenModal({})} class="w-full justify-start rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 shadow-none border-none py-4 text-xs font-bold transition-colors">
						<Plus class="h-3.5 w-3.5 mr-2 text-current" />
						Create New Debt
					</Button>
					<a href={resolve(`/dashboard/import`, {})} class="w-full justify-start rounded-lg border border-zinc-100 bg-white dark:border-zinc-800 dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-850 shadow-none py-3 text-xs font-bold transition-colors inline-flex items-center px-4">
						<FileSpreadsheet class="h-3.5 w-3.5 mr-2 text-zinc-400" />
						Import Debts
					</a>
				</div>
			</div>
		</div>
	</Card.Content>
</Card.Root>

<!-- Recent Activity -->
<Card.Root class="mb-6 border-0 bg-white dark:bg-zinc-900 shadow-[0_4px_12px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.2)] rounded-lg">
	<Card.Header class="pb-3.5 pt-4 px-4">
		<Card.Title class="flex items-center gap-2 text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
			<Clock class="h-4 w-4 text-zinc-400" />
			Recent Debt Activity
		</Card.Title>
		<Card.Description class="text-[10px] text-zinc-400 mt-0.5">
			Your recently created or updated debts
		</Card.Description>
	</Card.Header>
	<Card.Content class="pb-4 pt-0 px-4">
		{#if recentDebts.length === 0}
			<div class="text-center py-8 text-zinc-400">
				<p class="text-xs">No recent debt activity</p>
				<Button onclick={() => onOpenModal({})} class="mt-4 rounded-lg px-5 bg-zinc-900 text-white hover:bg-zinc-800 shadow-none text-xs">
					Create Your First Debt
				</Button>
			</div>
		{:else}
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				{#each recentDebts as debt (debt.id)}
					<button
						type="button"
						class="group flex items-center justify-between p-3.5 border border-zinc-100 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-850/50 transition-colors duration-200 w-full text-left cursor-pointer"
						onclick={() => onOpenModal({
							description: debt.description || '',
							amount: debt.amount.toString(),
							phone: debt.phone || debt.counterpartyPhone || undefined
						})}
					>
						<div class="flex items-center gap-3 flex-1 min-w-0">
							<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-50 dark:bg-zinc-800 font-bold text-xs text-zinc-400 group-hover:bg-zinc-100 dark:group-hover:bg-zinc-700 transition-colors">
								{((debt.description || 'N')[0]).toUpperCase()}
							</div>
							<div class="min-w-0">
								<div class="font-bold text-zinc-800 dark:text-zinc-100 truncate text-xs">{debt.description || 'No description'}</div>
								<div class="text-[10px] text-zinc-400 mt-0.5 truncate">
									{#if debt.phone || debt.counterpartyPhone}
										Phone: {debt.phone || debt.counterpartyPhone}
									{:else if debt.counterpartyName}
										{debt.counterpartyName}
									{/if}
								</div>
							</div>
						</div>
						<div class="text-right ml-4">
							<div class="text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
								{new Intl.NumberFormat('vi-VN', {
									style: 'currency',
									currency: 'VND'
								}).format(Number(debt.amount))}
							</div>
							<div class="text-[9px] text-zinc-400 mt-0.5">
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
