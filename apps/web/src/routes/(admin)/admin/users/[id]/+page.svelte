<script lang="ts">
	import { ArrowLeft, Calendar, DollarSign, Phone, Shield, TrendingDown, TrendingUp, User, UserCheck, UserX } from '@repo/icons';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { formatCurrency, formatDate } from '@repo/utils';

	let { data, form } = $props();

	let isSubmitting = $state(false);

	const debtStats = $derived(() => {
		const debts = data.debts ?? [];
		const userId = data.targetUser?.id;

		let totalOwed = 0; // Money owed TO this user
		let totalOwing = 0; // Money this user OWES

		for (const debt of debts) {
			if (debt.status === 'PAID') continue;
			if (debt.creditorId === userId) {
				totalOwed += debt.amount;
			} else if (debt.debtorId === userId) {
				totalOwing += debt.amount;
			}
		}

		return { totalOwed, totalOwing, count: debts.length };
	});
</script>

<svelte:head>
	<title>{data.targetUser?.name || 'User'} | User Management</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<!-- Back Link -->
	<a
		href="/admin/users"
		class="mb-6 inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
	>
		<ArrowLeft class="h-4 w-4" />
		Back to Users
	</a>

	<!-- User Header -->
	<div class="mb-6 rounded-xl border bg-card p-6 shadow-sm">
		<div class="flex flex-wrap items-start justify-between gap-4">
			<div class="flex items-center gap-4">
				<div class="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
					<User class="h-8 w-8 text-primary" />
				</div>
				<div>
					<h1 class="text-2xl font-bold">{data.targetUser?.name || 'No name'}</h1>
					<p class="text-muted-foreground">{data.targetUser?.email}</p>
				</div>
			</div>

			<!-- Status Toggle -->
			<form
				method="POST"
				action="?/toggleStatus"
				use:enhance={() => {
					isSubmitting = true;
					return async ({ update }) => {
						await update();
						isSubmitting = false;
						invalidateAll();
					};
				}}
			>
				{#if data.targetUser?.isActive !== false}
					<button
						type="submit"
						disabled={isSubmitting}
						class="flex items-center gap-2 rounded-lg bg-red-100 px-4 py-2 font-medium text-red-700 transition-colors hover:bg-red-200 disabled:opacity-50 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
					>
						<UserX class="h-4 w-4" />
						{isSubmitting ? 'Processing...' : 'Deactivate User'}
					</button>
				{:else}
					<button
						type="submit"
						disabled={isSubmitting}
						class="flex items-center gap-2 rounded-lg bg-green-100 px-4 py-2 font-medium text-green-700 transition-colors hover:bg-green-200 disabled:opacity-50 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50"
					>
						<UserCheck class="h-4 w-4" />
						{isSubmitting ? 'Processing...' : 'Reactivate User'}
					</button>
				{/if}
			</form>
		</div>

		{#if form?.error}
			<div class="mt-4 rounded-lg bg-red-100 p-3 text-red-700 dark:bg-red-900/30 dark:text-red-300">
				{form.error}
			</div>
		{/if}

		<!-- User Details Grid -->
		<div class="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
			<div class="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
				<Phone class="h-5 w-5 text-muted-foreground" />
				<div>
					<p class="text-xs text-muted-foreground">Phone</p>
					<p class="font-medium">{data.targetUser?.phoneNumber || '—'}</p>
				</div>
			</div>
			<div class="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
				<Shield class="h-5 w-5 text-muted-foreground" />
				<div>
					<p class="text-xs text-muted-foreground">Role</p>
					<p class="font-medium capitalize">{data.targetUser?.role}</p>
				</div>
			</div>
			<div class="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
				<Calendar class="h-5 w-5 text-muted-foreground" />
				<div>
					<p class="text-xs text-muted-foreground">Joined</p>
					<p class="font-medium">{formatDate(data.targetUser?.createdAt)}</p>
				</div>
			</div>
			<div class="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
				{#if data.targetUser?.isActive !== false}
					<UserCheck class="h-5 w-5 text-green-600" />
					<div>
						<p class="text-xs text-muted-foreground">Status</p>
						<p class="font-medium text-green-600">Active</p>
					</div>
				{:else}
					<UserX class="h-5 w-5 text-red-600" />
					<div>
						<p class="text-xs text-muted-foreground">Status</p>
						<p class="font-medium text-red-600">Inactive</p>
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Debt Statistics -->
	<div class="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
		<div class="rounded-xl border bg-card p-6 shadow-sm">
			<div class="flex items-center gap-3">
				<div class="rounded-lg bg-blue-100 p-3 dark:bg-blue-900/30">
					<DollarSign class="h-5 w-5 text-blue-600 dark:text-blue-400" />
				</div>
				<div>
					<p class="text-sm text-muted-foreground">Total Debts</p>
					<p class="text-2xl font-bold">{debtStats().count}</p>
				</div>
			</div>
		</div>
		<div class="rounded-xl border bg-card p-6 shadow-sm">
			<div class="flex items-center gap-3">
				<div class="rounded-lg bg-green-100 p-3 dark:bg-green-900/30">
					<TrendingUp class="h-5 w-5 text-green-600 dark:text-green-400" />
				</div>
				<div>
					<p class="text-sm text-muted-foreground">Owed to User</p>
					<p class="text-2xl font-bold text-green-600">{formatCurrency(debtStats().totalOwed)}</p>
				</div>
			</div>
		</div>
		<div class="rounded-xl border bg-card p-6 shadow-sm">
			<div class="flex items-center gap-3">
				<div class="rounded-lg bg-red-100 p-3 dark:bg-red-900/30">
					<TrendingDown class="h-5 w-5 text-red-600 dark:text-red-400" />
				</div>
				<div>
					<p class="text-sm text-muted-foreground">User Owes</p>
					<p class="text-2xl font-bold text-red-600">{formatCurrency(debtStats().totalOwing)}</p>
				</div>
			</div>
		</div>
	</div>

	<!-- Debts Table -->
	<div class="overflow-hidden rounded-xl border bg-card shadow-sm">
		<div class="border-b p-4">
			<h2 class="text-lg font-semibold">Debt Records</h2>
		</div>
		<div class="overflow-x-auto">
			<table class="w-full">
				<thead class="bg-muted/50">
					<tr>
						<th class="px-6 py-3 text-left text-sm font-semibold">Description</th>
						<th class="px-6 py-3 text-left text-sm font-semibold">Amount</th>
						<th class="px-6 py-3 text-left text-sm font-semibold">Direction</th>
						<th class="px-6 py-3 text-left text-sm font-semibold">Counterparty</th>
						<th class="px-6 py-3 text-left text-sm font-semibold">Status</th>
						<th class="px-6 py-3 text-left text-sm font-semibold">Date</th>
					</tr>
				</thead>
				<tbody class="divide-y">
					{#each data.debts ?? [] as debt (debt.id)}
						{@const isCreditor = debt.creditorId === data.targetUser?.id}
						<tr class="transition-colors hover:bg-muted/30">
							<td class="px-6 py-4 text-sm">{debt.description || '—'}</td>
							<td class="px-6 py-4 font-medium">{formatCurrency(debt.amount)}</td>
							<td class="px-6 py-4">
								{#if isCreditor}
									<span class="flex items-center gap-1 text-green-600">
										<TrendingUp class="h-4 w-4" />
										Lent
									</span>
								{:else}
									<span class="flex items-center gap-1 text-red-600">
										<TrendingDown class="h-4 w-4" />
										Borrowed
									</span>
								{/if}
							</td>
							<td class="px-6 py-4 text-sm">
								{isCreditor
									? debt.debtorPhone || 'User ' + debt.debtorId?.slice(0, 8)
									: debt.creditorPhone || 'User ' + debt.creditorId?.slice(0, 8)}
							</td>
							<td class="px-6 py-4">
								<span
									class="rounded-full px-2 py-1 text-xs font-medium
									{debt.status === 'PAID'
										? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
										: debt.status === 'PENDING'
											? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
											: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300'}"
								>
									{debt.status}
								</span>
							</td>
							<td class="px-6 py-4 text-sm text-muted-foreground">
								{formatDate(debt.createdAt)}
							</td>
						</tr>
					{:else}
						<tr>
							<td colspan="6" class="px-6 py-12 text-center text-muted-foreground">
								No debt records found for this user
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</div>
