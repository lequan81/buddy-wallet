<script lang="ts">
	import * as Table from '$lib/components/ui/table';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import CheckSquare from '~icons/lucide/check-square';
import Square from '~icons/lucide/square';
import Eye from '~icons/lucide/eye';
import Trash2 from '~icons/lucide/trash-2';
	import { formatCurrency, formatDate } from '@repo/utils/format';
	import { cn } from '$lib/utils';
	import { resolve } from '$app/paths';
	import DebtStatusBadge from '$lib/components/DebtStatusBadge.svelte';
	import { api } from '$lib/services/api';
	import { toast } from 'svelte-sonner';
	import { invalidateAll } from '$app/navigation';
	import type { DebtDetails } from '@repo/types/shared/debt';
	import type { DashboardState } from '$lib/dashboard/state.svelte';

	interface Props {
		readonly debt: DebtDetails;
		readonly dashState: DashboardState;
	}

	let { debt, dashState }: Props = $props();
	let canDelete = $derived(dashState.canDeleteDebt(debt));

	let counterpartyInfo = $derived.by(() => {
		const direction = debt.direction || 'LEND';
		const isLender = direction === 'LEND';
		const isRegistered = isLender ? !!debt.debtorId : !!debt.creditorId;
		const registeredName = isLender ? debt.debtorName : debt.creditorName;
		const customName = isLender ? debt.customDebtorName : debt.customCreditorName;
		const isMismatch = !!(isRegistered && customName && registeredName && customName !== registeredName);
		return {
			isRegistered,
			registeredName,
			customName,
			isMismatch,
			direction
		};
	});

	async function unifyName(id: string, name: string, direction: 'LEND' | 'BORROW') {
		try {
			const body = direction === 'LEND'
				? { customDebtorName: name }
				: { customCreditorName: name };

			const { error } = await (api.v1.debts({ id }).patch as (
				data: typeof body
			) => Promise<{ error: unknown }>)(body);
			if (error) {
				toast.error('Failed to unify name');
				return;
			}
			toast.success('Display name unified successfully!');
			await invalidateAll();
		} catch {
			toast.error('Error unifying name');
		}
	}
</script>

<Table.Row class={cn('transition-colors duration-150 hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40', dashState.selectedIds.has(debt.id) && 'bg-zinc-50 dark:bg-zinc-850')}>
	<Table.Cell class="pl-6 py-2.5">
		{#if canDelete}
			<button
				class="flex items-center justify-center transition-colors"
				onclick={() => dashState.toggleSelect(debt.id)}
			>
				{#if dashState.selectedIds.has(debt.id)}
					<CheckSquare class="h-4 w-4 text-zinc-900 dark:text-zinc-100" />
				{:else}
					<Square class="h-4 w-4 text-zinc-300 dark:text-zinc-700 hover:text-zinc-950 transition-colors" />
				{/if}
			</button>
		{:else}
			<span class="h-4 w-4"></span>
		{/if}
	</Table.Cell>
	<Table.Cell class="max-w-64 py-2.5">
		<div class="truncate font-bold text-zinc-850 dark:text-zinc-100 text-[13px]">{debt.description || '—'}</div>
		<div class="text-[9.5px] text-zinc-400 mt-0.5 font-medium flex items-center flex-wrap gap-1.5">
			{#if counterpartyInfo.isMismatch}
				<span class="text-zinc-500 font-bold">
					{counterpartyInfo.registeredName} <span class="font-normal text-zinc-400 opacity-80">({counterpartyInfo.customName})</span>
				</span>
				<button
					type="button"
					class="inline-flex items-center px-1.5 py-0.5 rounded border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-850 text-[8px] text-zinc-500 dark:text-zinc-400 font-bold hover:bg-zinc-100 dark:hover:bg-zinc-750 cursor-pointer transition-colors"
					onclick={async (e) => {
						e.stopPropagation();
						await unifyName(debt.id, counterpartyInfo.registeredName || '', counterpartyInfo.direction);
					}}
				>
					Unify Name
				</button>
			{:else}
				<span class="opacity-90">{counterpartyInfo.registeredName || counterpartyInfo.customName || 'Unregistered'}</span>
			{/if}
		</div>
	</Table.Cell>
	<Table.Cell class="py-2.5">
		<DebtStatusBadge status={debt.status} class="text-[10px] font-bold shadow-none px-2 py-0.5 rounded-full" />
	</Table.Cell>
	<Table.Cell class="font-tabular font-bold tracking-tight text-right text-zinc-900 dark:text-zinc-50 text-xs py-2.5">
		{formatCurrency(debt.amount)}
	</Table.Cell>
	<Table.Cell class="text-zinc-400 dark:text-zinc-500 font-medium tabular-nums text-[10px] py-2.5">
		{formatDate(debt.createdAt)}
	</Table.Cell>
	<Table.Cell class="pr-6 text-right py-2.5">
		<div class="flex items-center justify-end gap-1">
			<a class={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), "h-7 w-7 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-md transition-colors shadow-none border-none duration-150")} href={resolve(`/debts/${debt.id}`, {})}>
				<Eye class="h-3.5 w-3.5" />
			</a>

			{#if canDelete}
				<AlertDialog.Root
					open={dashState.deleteId === debt.id}
					onOpenChange={(open: boolean) => {
						if (!open) dashState.deleteId = '';
					}}
				>
					<AlertDialog.Trigger>
						{#snippet child({ props }: { props: Record<string, unknown> })}
							<Button
								variant="ghost"
								size="sm"
								class="h-7 w-7 text-zinc-400 hover:text-destructive hover:bg-destructive/5 rounded-md transition-colors shadow-none border-none duration-150"
								onclick={() => (dashState.deleteId = debt.id)}
								{...props}
							>
								<Trash2 class="h-3.5 w-3.5" />
							</Button>
						{/snippet}
					</AlertDialog.Trigger>
					<AlertDialog.Content class="rounded-lg border border-zinc-100 bg-white dark:border-zinc-800 dark:bg-zinc-900 shadow-xl">
						<AlertDialog.Header>
							<AlertDialog.Title class="text-sm font-bold text-zinc-900 dark:text-zinc-50">Delete Debt</AlertDialog.Title>
							<AlertDialog.Description class="text-xs text-zinc-400">
								Are you sure you want to delete this debt? This action cannot be undone.
							</AlertDialog.Description>
						</AlertDialog.Header>
						<AlertDialog.Footer>
							<AlertDialog.Cancel class="rounded-lg text-xs font-semibold px-4 py-2 border-zinc-200">Cancel</AlertDialog.Cancel>
							<AlertDialog.Action
								disabled={dashState.isDeleting}
								class="bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 rounded-lg text-xs font-bold px-4 py-2"
								onclick={async () => {
									if (dashState.isDeleting) return;
									dashState.isDeleting = true;
									try {
										const { error } = await api.v1.debts({ id: debt.id }).delete();
										if (error) {
											toast.error('Failed to delete debt');
											return;
										}
										toast.success('Debt deleted');
										dashState.deleteId = '';
										await invalidateAll();
									} catch {
										toast.error('Failed to delete debt');
									} finally {
										dashState.isDeleting = false;
									}
								}}
							>
								{dashState.isDeleting ? 'Deleting...' : 'Delete'}
							</AlertDialog.Action>
						</AlertDialog.Footer>
					</AlertDialog.Content>
				</AlertDialog.Root>
			{/if}
		</div>
	</Table.Cell>
</Table.Row>
