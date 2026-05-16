<script lang="ts">
	import * as Table from '@repo/ui/components/ui/table';
	import { Button } from '@repo/ui/components/ui/button';
	import * as AlertDialog from '@repo/ui/components/ui/alert-dialog';
	import { CheckSquare, Square, Eye, Trash2 } from '@repo/icons';
	import { formatCurrency, formatDate } from '@repo/utils/format';
	import { cn } from '$lib/utils';
	import { resolve } from '$app/paths';
	import DebtStatusBadge from '$lib/components/DebtStatusBadge.svelte';
	import { api } from '$lib/services/api';
	import { toast } from 'svelte-sonner';
	import { invalidateAll } from '$app/navigation';

	interface Props {
		readonly debt: any;
		readonly dashState: any;
	}

	let { debt, dashState }: Props = $props();
	let canDelete = $derived(dashState.canDeleteDebt(debt));
</script>

<Table.Row class={cn(dashState.selectedIds.has(debt.id) && 'bg-muted/50')}>
	<Table.Cell class="pl-6">
		{#if canDelete}
			<button
				class="flex items-center justify-center"
				onclick={() => dashState.toggleSelect(debt.id)}
			>
				{#if dashState.selectedIds.has(debt.id)}
					<CheckSquare class="h-4 w-4 text-foreground" />
				{:else}
					<Square class="h-4 w-4 text-muted-foreground" />
				{/if}
			</button>
		{:else}
			<span class="h-4 w-4"></span>
		{/if}
	</Table.Cell>
	<Table.Cell class="max-w-50 truncate font-medium">
		{debt.description || 'â€”'}
	</Table.Cell>
	<Table.Cell>
		<DebtStatusBadge status={debt.status} />
	</Table.Cell>
	<Table.Cell class="font-tabular text-right">
		{formatCurrency(debt.amount)}
	</Table.Cell>
	<Table.Cell class="text-muted-foreground tabular-nums">
		{formatDate(debt.createdAt)}
	</Table.Cell>
	<Table.Cell class="pr-6 text-right">
		<div class="flex items-center justify-end gap-1">
			<Button variant="ghost" size="sm" href={resolve(`/debts/${debt.id}`, {})}>
				<Eye class="h-4 w-4 text-muted-foreground" />
			</Button>

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
								class="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
								onclick={() => (dashState.deleteId = debt.id)}
								{...props}
							>
								<Trash2 class="h-4 w-4" />
							</Button>
						{/snippet}
					</AlertDialog.Trigger>
					<AlertDialog.Content>
						<AlertDialog.Header>
							<AlertDialog.Title>Delete Debt</AlertDialog.Title>
							<AlertDialog.Description>
								Are you sure you want to delete this debt? This action cannot be undone.
							</AlertDialog.Description>
						</AlertDialog.Header>
						<AlertDialog.Footer>
							<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
							<AlertDialog.Action
							disabled={dashState.isDeleting}
							class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
