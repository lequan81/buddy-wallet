<script lang="ts">
	import Circle from '~icons/lucide/circle';
import CheckCircle2 from '~icons/lucide/check-circle-2';
import XCircle from '~icons/lucide/x-circle';
	import * as Card from '$lib/components/ui/card';
	import { formatDate } from '@repo/utils/format';
	import type { DebtDetails } from '@repo/types/shared/debt';

	let { debt } = $props<{ debt: DebtDetails }>();

	// Mocking some events since the backend might not provide a full log yet
	// In a real app, this would come from debt.activities or similar
	const events = $derived([
		{ 
			id: '1', 
			type: 'created', 
			title: 'Debt Created', 
			description: `Created by ${debt.uploadedById === debt.creditorId ? 'Creditor' : 'Debtor'}`, 
			date: debt.createdAt,
			icon: Circle
		},
		...(debt.status === 'confirmed' ? [{
			id: '2',
			type: 'confirmed',
			title: 'Debt Confirmed',
			description: 'Confirmed by Debtor',
			date: debt.updatedAt,
			icon: CheckCircle2
		}] : []),
		...(debt.status === 'paid' ? [{
			id: '3',
			type: 'paid',
			title: 'Debt Marked as Paid',
			description: 'Payment verified by Creditor',
			date: debt.updatedAt,
			icon: CheckCircle2
		}] : []),
		...(debt.status === 'cancelled' ? [{
			id: '4',
			type: 'cancelled',
			title: 'Debt Cancelled',
			description: 'Action cancelled',
			date: debt.updatedAt,
			icon: XCircle
		}] : [])
	].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
</script>

<Card.Root class="border-0 bg-white dark:bg-zinc-900 shadow-[0_4px_12px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.2)] rounded-lg">
	<Card.Header>
		<Card.Title class="text-sm font-medium">Activity Timeline</Card.Title>
	</Card.Header>
	<Card.Content>
		<div class="relative space-y-6 before:absolute before:inset-y-0 before:left-2 before:w-px before:bg-zinc-100 dark:before:bg-zinc-800">
			{#each events as event (event.id)}
				<div class="relative pl-8">
					<div class="absolute left-0 flex h-4 w-4 items-center justify-center rounded-full bg-white dark:bg-zinc-950 ring-1 ring-zinc-200 dark:ring-zinc-850">
						<event.icon class="h-3 w-3 text-muted-foreground" />
					</div>
					<div class="flex flex-col gap-1">
						<div class="flex items-center justify-between">
							<p class="text-xs font-medium">{event.title}</p>
							<span class="text-[10px] text-muted-foreground">{formatDate(event.date)}</span>
						</div>
						<p class="text-[10px] text-muted-foreground">{event.description}</p>
					</div>
				</div>
			{/each}
		</div>
	</Card.Content>
</Card.Root>
