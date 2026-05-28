<script lang="ts">
	import Calendar from '~icons/lucide/calendar';
import Phone from '~icons/lucide/phone';
import FileText from '~icons/lucide/file-text';
import Edit from '~icons/lucide/edit';
import Clock from '~icons/lucide/clock';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { formatCurrency, formatDate } from '@repo/utils/format';
	import type { DebtDetails } from '@repo/types/shared/debt';

	let { debt, isCreditor, onEdit }: {
		debt: DebtDetails,
		isCreditor: boolean,
		onEdit: () => void
	} = $props();
</script>

<Card.Root>
	<Card.Header class="pb-3">
		<div class="flex items-center justify-between">
			<Card.Title class="text-sm font-medium">Debt Overview</Card.Title>
			{#if isCreditor && debt.status !== 'cancelled' && debt.status !== 'paid'}
				<Button variant="ghost" size="sm" onclick={onEdit}>
					<Edit class="mr-2 h-3.5 w-3.5" />
					Edit
				</Button>
			{/if}
		</div>
	</Card.Header>
	<Card.Content class="grid gap-6">
		<div class="flex items-center justify-between">
			<div class="space-y-1">
				<p class="text-xs text-muted-foreground uppercase tracking-wider">Amount</p>
				<p class="text-3xl font-bold tracking-tight text-primary">
					{formatCurrency(debt.amount, debt.currency)}
				</p>
			</div>
			<div class="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
				<FileText class="h-6 w-6 text-primary" />
			</div>
		</div>

		<div class="grid grid-cols-2 gap-4">
			<div class="space-y-1">
				<p class="text-xs text-muted-foreground">Creditor</p>
				<div class="flex flex-wrap items-center gap-2">
					{#if debt.creditorId && debt.customCreditorName && debt.creditorName && debt.customCreditorName !== debt.creditorName}
						<p class="text-sm font-medium">
							{debt.creditorName} <span class="text-xs text-muted-foreground">({debt.customCreditorName})</span>
						</p>
					{:else}
						<p class="text-sm font-medium">{debt.creditorName || debt.customCreditorName || debt.creditorPhone}</p>
					{/if}
				</div>
				<p class="text-xs text-muted-foreground flex items-center gap-1">
					<Phone class="h-3 w-3" /> {debt.creditorPhone}
				</p>
			</div>
			<div class="space-y-1">
				<p class="text-xs text-muted-foreground">Debtor</p>
				<div class="flex flex-wrap items-center gap-2">
					{#if debt.debtorId && debt.customDebtorName && debt.debtorName && debt.customDebtorName !== debt.debtorName}
						<p class="text-sm font-medium">
							{debt.debtorName} <span class="text-xs text-muted-foreground">({debt.customDebtorName})</span>
						</p>
					{:else}
						<p class="text-sm font-medium">{debt.debtorName || debt.customDebtorName || debt.debtorPhone}</p>
					{/if}
				</div>
				<p class="text-xs text-muted-foreground flex items-center gap-1">
					<Phone class="h-3 w-3" /> {debt.debtorPhone}
				</p>
			</div>
		</div>

		<div class="flex items-center gap-4 pt-2">
			<div class="flex items-center gap-2 text-xs text-muted-foreground">
				<Calendar class="h-3.5 w-3.5" />
				<span>Created: {formatDate(debt.createdAt)}</span>
			</div>
			{#if debt.dueDate}
				<div class="flex items-center gap-2 text-xs text-muted-foreground">
					<Clock class="h-3.5 w-3.5" />
					<span>Due: {formatDate(debt.dueDate)}</span>
				</div>
			{/if}
		</div>
	</Card.Content>
</Card.Root>
