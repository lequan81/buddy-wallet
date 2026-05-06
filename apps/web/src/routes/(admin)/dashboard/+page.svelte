<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { resolve } from '$app/paths';
	import { batchDeleteDebts, deleteDebt, deleteAllDebts } from '$lib/remotes/debts.remote';
	import { untrack } from 'svelte'; 
	import { invalidateAll, goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { toast } from 'svelte-sonner';
	import * as Card from '@repo/ui/components/ui/card';
	import { Button } from '@repo/ui/components/ui/button';
	import PageContainer from '$lib/components/layout/PageContainer.svelte';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import QuickActions from '$lib/components/dashboard/QuickActions.svelte';
	import FinancialSummary from '$lib/components/dashboard/FinancialSummary.svelte';
	import { formatCurrency, formatDate } from '@repo/utils/format';
	import type { Debt } from '@repo/types/core/debt';
	import { DEBT_STATUS } from '@repo/config/shared/status';
	import CreateDebtModal from '$lib/components/dashboard/CreateDebtModal.svelte';
	import { createDashboardState } from './dashboard.svelte';
	import DashboardStats from '$lib/components/dashboard/DashboardStats.svelte';
	import DebtsTable from '$lib/components/dashboard/DebtsTable.svelte';
	
	import {
		Plus,
		Download,
		FileSpreadsheet,
		Clock
	} from '@repo/icons';

	let { data, form }: { data: PageData, form: ActionData } = $props();

	let createDebtModalOpen = $state(false);
	let modalInitialDescription = $state('');
	let modalInitialAmount = $state('');
	let modalInitialPhone = $state('');

	function handleOpenCreateModal(data: Record<string, string> = {}) {
		modalInitialDescription = data.description || '';
		modalInitialAmount = data.amount || '';
		modalInitialPhone = data.phone || '';
		createDebtModalOpen = true;
	}

	interface RemoteFormInstance {
		fields: {
			allIssues: () => Array<{ message: string; path?: (string | number)[] }>;
		};
		result?: {
			success?: boolean;
			deleted?: number;
		};
	}

	// Toast on form results
	$effect(() => {
		if (form && typeof form === 'object') {
			if ('error' in form && form.error) {
				const errorMessage = typeof form.error === 'string' 
					? form.error 
					: (form.error as { message?: string }).message || 'An error occurred';
				toast.error(errorMessage);
			}
			if ('success' in form && form.success) {
				const deletedCount = (form as Record<string, unknown>).deleted as number | undefined;
				toast.success(`${deletedCount || 1} debt(s) deleted successfully`);
			}
		}
	});

	// Toast for deletion redirect
	$effect(() => {
		if ($page.url.searchParams.get('deleted')) {
			toast.success('Debt deleted successfully');
			goto('/dashboard', { replaceState: true });
		}
	});

	// Toast for remote form results
	$effect(() => {
		const forms = [batchDeleteDebts, deleteDebt, deleteAllDebts] as RemoteFormInstance[];
		for (const remoteForm of forms) {
			const issues = remoteForm.fields.allIssues();
			if (issues && issues.length > 0) {
				toast.error(issues[0].message || 'An error occurred');
			}
			if (remoteForm.result?.success) {
				toast.success(`Deleted ${remoteForm.result.deleted || 1} debt(s) successfully`);
			}
		}
	});

	// Use server-computed values
	let permissions = $derived(data.permissions);
	let currentUser = $derived(data.currentUser);

	const dashState = untrack(() => createDashboardState(currentUser?.id || ''));

	// Pagination from server (URL params)
	let currentPage = $derived(data.page || 1);
	let pageSize = $derived(data.pageSize || 10);
	let statusFilter = $derived(data.statusFilter || 'all');
</script>

<PageContainer>
	<PageHeader title="Dashboard" description="Overview of your debts and activity">
		{#snippet actions()}
			<div class="flex flex-wrap gap-2">
				<Button onclick={() => handleOpenCreateModal()} size="sm" class="shadow-sm">
					<Plus class="mr-2 h-4 w-4" /> New Debt
				</Button>
				{#if permissions.canImportData}
					<Button variant="outline" href={resolve(`/dashboard/import`, {})} size="sm">
						<Download class="mr-2 h-4 w-4" /> Import
					</Button>
				{/if}
				{#if permissions.canExportData}
					<form method="POST" action="?/exportDebts">
						<Button type="submit" variant="outline" size="sm">
							<FileSpreadsheet class="mr-2 h-4 w-4" /> Export
						</Button>
					</form>
				{/if}
			</div>
		{/snippet}
	</PageHeader>

	<!-- Quick Actions -->
	{#await data.streamed.recentDebts then recentDebts}
		<QuickActions onOpenModal={handleOpenCreateModal} recentDebts={recentDebts} />
	{:catch}
		<QuickActions onOpenModal={handleOpenCreateModal} />
	{/await}

	<div class="space-y-6">
		{#await data.streamed.debtsData}
			<!-- Loading skeleton grid -->
			<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				<div class="h-32 animate-pulse rounded-xl bg-muted/50"></div>
				<div class="h-32 animate-pulse rounded-xl bg-muted/50"></div>
				<div class="h-32 animate-pulse rounded-xl bg-muted/50"></div>
				<div class="h-32 animate-pulse rounded-xl bg-muted/50"></div>
			</div>
			<!-- Table skeleton -->
			<div class="h-125 animate-pulse rounded-xl bg-muted/50"></div>
		{:then debtsResult}
			{@const { debts, pagination } = debtsResult as { 
				debts: Debt[]; 
				pagination: { total: number; limit: number; offset: number; hasMore: boolean } 
			}}

			<!-- Financial Summary -->
			<FinancialSummary
				totalOwedToYou={debts
					.filter(
						(d: Debt) =>
							d.creditorId === currentUser?.id && d.status !== DEBT_STATUS.PAID && d.status !== DEBT_STATUS.CANCELLED
					)
					.reduce((acc: number, d: Debt) => acc + d.amount, 0)}
				totalYouOwe={debts
					.filter(
						(d: Debt) =>
							d.debtorId === currentUser?.id && d.status !== DEBT_STATUS.PAID && d.status !== DEBT_STATUS.CANCELLED
					)
					.reduce((acc: number, d: Debt) => acc + d.amount, 0)}
			/>

			<!-- Action Required / Pending Confirmation Alert -->
			{@const debtsNeedingMyConfirmation = debts.filter((d: Debt) => {
				if (!d.needsConfirmation) return false;
				if (d.uploadedById === currentUser?.id) return false;
				const isCreditor = d.creditorId === currentUser?.id;
				const isDebtor = d.debtorId === currentUser?.id;
				if (isCreditor && !d.confirmedByCreditor) return true;
				if (isDebtor && !d.confirmedByDebtor) return true;
				return false;
			})}

			{#if debtsNeedingMyConfirmation.length > 0}
				<Card.Root class="border-warning/50 bg-warning/5">
					<Card.Header>
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								<Clock class="h-5 w-5 text-warning" />
								<Card.Title class="text-lg text-warning-foreground">Action Required</Card.Title>
							</div>
							<div class="inline-flex items-center rounded-full border border-warning px-2.5 py-0.5 text-xs font-semibold text-warning-foreground">
								{debtsNeedingMyConfirmation.length} pending
							</div>
						</div>
						<Card.Description class="text-yellow-800 dark:text-yellow-200">
							These debts are waiting for your confirmation
						</Card.Description>
					</Card.Header>
					<Card.Content>
						<div class="space-y-2">
							{#each debtsNeedingMyConfirmation.slice(0, 3) as debt}
								<a
									href={resolve(`/debts/${debt.id}`, {})}
									class="flex items-center justify-between rounded-lg border border-yellow-200 bg-white p-3 transition-colors hover:bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/30 dark:hover:bg-yellow-900/30"
								>
									<div class="flex-1">
										<p class="font-medium text-yellow-900 dark:text-yellow-100">
											{debt.description || 'No description'}
										</p>
										<p class="text-sm text-yellow-700 dark:text-yellow-300">
											{debt.creditorId === currentUser?.id
												? `${debt.debtorPhone} says they owe you`
												: `You owe ${debt.creditorPhone}`}
										</p>
									</div>
									<div class="text-right">
										<p class="font-tabular font-semibold text-yellow-900 dark:text-yellow-100">
											{formatCurrency(debt.amount)}
										</p>
										<p class="text-xs text-yellow-600 dark:text-yellow-400">
											{formatDate(debt.createdAt)}
										</p>
									</div>
								</a>
							{/each}
						</div>
					</Card.Content>
				</Card.Root>
			{/if}

			<!-- Modular Dashboard Components -->
			<DashboardStats 
				totalUsers={data.streamed.users}
				totalDebts={debts.length}
				pendingDebts={debts.filter((d: Debt) => d.status === DEBT_STATUS.PENDING).length}
				canManageUsers={permissions.canManageUsers}
			/>

			<DebtsTable 
				{debts} 
				{pagination} 
				{dashState} 
				{permissions} 
				{statusFilter}
				{pageSize}
				{currentPage}
				onOpenCreateModal={() => handleOpenCreateModal()}
			/>
		{/await}
	</div>
</PageContainer>

<CreateDebtModal
	bind:open={createDebtModalOpen}
	initialDescription={modalInitialDescription}
	initialAmount={modalInitialAmount}
	initialPhone={modalInitialPhone}
	onSuccess={invalidateAll}
/>
