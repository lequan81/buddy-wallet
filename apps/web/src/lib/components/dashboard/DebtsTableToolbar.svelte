<script lang="ts">
	import Search from '~icons/lucide/search';
import X from '~icons/lucide/x';
import Filter from '~icons/lucide/filter';
import Trash2 from '~icons/lucide/trash-2';
import Plus from '~icons/lucide/plus';
	import { Button } from '$lib/components/ui/button';
	import * as AlertDialog from '$lib/components/ui/alert-dialog';
	import { cn } from '$lib/utils';
	import { api } from '$lib/services/api';
	import { toast } from 'svelte-sonner';
	import { invalidateAll } from '$app/navigation';

	import { type Snippet } from 'svelte';
	import type { DashboardState } from '$lib/dashboard/state.svelte';

	interface Props {
		readonly dashState: DashboardState;
		readonly hasDebts: boolean;
		readonly title?: Snippet;
		readonly onOpenCreateModal: () => void;
		readonly isAdmin: boolean;
	}

	let { dashState, hasDebts, title, onOpenCreateModal, isAdmin }: Props = $props();
</script>

<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
	<div>
		{@render title?.()}
		<p class="text-sm text-muted-foreground">
			{isAdmin ? 'All system debts' : 'Your debt records'}
		</p>
	</div>

	<!-- Filter & Bulk Actions -->
	<div class="flex flex-wrap items-center gap-2">
		<!-- Search Input -->
		<div class="relative">
			<Search class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
			<input
				type="text"
				placeholder="Search debts..."
				bind:value={dashState.searchQuery}
				class="h-9 w-48 rounded-md border bg-background pr-8 pl-9 text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none"
			/>
			{#if dashState.searchQuery}
				<button
					onclick={() => (dashState.searchQuery = '')}
					class="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
				>
					<X class="h-4 w-4" />
				</button>
			{/if}
		</div>

		<!-- Status Filter -->
		<div class="flex items-center gap-1 rounded-lg border p-1">
			<Filter class="ml-1 h-4 w-4 text-muted-foreground" />
			{#each ['all', 'pending', 'confirmed', 'paid', 'disputed', 'cancelled'] as status}
				<button
					class={cn(
						'rounded px-2 py-1 text-xs font-medium transition-colors',
						dashState.statusFilter === status
							? 'bg-muted text-foreground'
							: 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
					)}
					onclick={() => dashState.setStatusFilter(status)}
				>
					{status.charAt(0).toUpperCase() + status.slice(1)}
				</button>
			{/each}
		</div>

		<!-- Bulk Delete Button -->
		{#if dashState.selectedIds.size > 0}
			<AlertDialog.Root>
				<AlertDialog.Trigger>
					{#snippet child({ props }: { props: Record<string, unknown> })}
						<Button variant="destructive" size="sm" {...props}>
							<Trash2 class="mr-2 h-4 w-4" />
							Delete ({dashState.selectedIds.size})
						</Button>
					{/snippet}
				</AlertDialog.Trigger>
				<AlertDialog.Content>
					<AlertDialog.Header>
						<AlertDialog.Title>Delete Selected Debts</AlertDialog.Title>
						<AlertDialog.Description>
							Are you sure you want to delete {dashState.selectedIds.size} debt(s)? This action
							cannot be undone.
						</AlertDialog.Description>
					</AlertDialog.Header>
					<AlertDialog.Footer>
						<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
						<AlertDialog.Action
							disabled={dashState.isSubmitting}
							class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onclick={async () => {
								if (dashState.isSubmitting) return;
								dashState.isSubmitting = true;
								try {
									const ids = Array.from(dashState.selectedIds) as string[];
									const { error } = await api.v1.debts.batch.delete({ ids });
									if (error) {
										toast.error('Failed to delete debts');
										return;
									}
									toast.success(`Deleted ${ids.length} debt(s)`);
									dashState.clearSelection();
									await invalidateAll();
								} catch {
									toast.error('Failed to delete debts');
								} finally {
									dashState.isSubmitting = false;
								}
							}}
						>
							{dashState.isSubmitting ? 'Deleting...' : 'Delete'}
						</AlertDialog.Action>
					</AlertDialog.Footer>
				</AlertDialog.Content>
			</AlertDialog.Root>
		{/if}

		<!-- Delete all debts (with confirmation) -->
		{#if hasDebts}
			<AlertDialog.Root>
				<AlertDialog.Trigger>
					{#snippet child({ props }: { props: Record<string, unknown> })}
						<Button variant="outline" size="sm" {...props}>
							<Trash2 class="mr-2 h-4 w-4" />
							Delete all
						</Button>
					{/snippet}
				</AlertDialog.Trigger>
				<AlertDialog.Content>
					<AlertDialog.Header>
						<AlertDialog.Title>Delete all debts</AlertDialog.Title>
						<AlertDialog.Description>
							Are you sure you want to delete all your debts? This action cannot be undone.
						</AlertDialog.Description>
					</AlertDialog.Header>
					<AlertDialog.Footer>
						<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
						<AlertDialog.Action
							disabled={dashState.isSubmitting}
							class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onclick={async () => {
								if (dashState.isSubmitting) return;
								dashState.isSubmitting = true;
								try {
									const { error } = await api.v1.debts.all.delete({}, { query: { confirm: 'true' } });
									if (error) {
										toast.error('Failed to delete all debts');
										return;
									}
									toast.success('All debts deleted');
									await invalidateAll();
								} catch {
									toast.error('Failed to delete all debts');
								} finally {
									dashState.isSubmitting = false;
								}
							}}
						>
							{dashState.isSubmitting ? 'Deleting...' : 'Delete all'}
						</AlertDialog.Action>
					</AlertDialog.Footer>
				</AlertDialog.Content>
			</AlertDialog.Root>
		{/if}
		<!-- New Debt Button -->
		<Button onclick={onOpenCreateModal} size="sm" class="shadow-sm">
			<Plus class="mr-2 h-4 w-4" /> New Debt
		</Button>
	</div>
</div>
