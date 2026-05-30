<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import Users from '~icons/lucide/users';
import FileText from '~icons/lucide/file-text';
import Clock from '~icons/lucide/clock';
	import { resolve } from '$app/paths';

	let { 
		totalUsers = 0, 
		totalDebts = 0, 
		pendingDebts = 0, 
		canManageUsers = false 
	}: { 
		totalUsers?: number | Promise<unknown[]>, 
		totalDebts?: number, 
		pendingDebts?: number,
		canManageUsers?: boolean
	} = $props();
</script>

<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
	{#if canManageUsers}
		{#if totalUsers instanceof Promise}
			{#await totalUsers}
				<div class="h-32 animate-pulse rounded-lg bg-zinc-50 dark:bg-zinc-800/30"></div>
			{:then users}
				<Card.Root class="overflow-hidden border-0 bg-white dark:bg-zinc-900 shadow-[0_4px_12px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.2)] rounded-lg transition-all duration-200 hover:shadow-[0_6px_20px_rgba(0,0,0,0.05)] dark:hover:shadow-[0_6px_20px_rgba(0,0,0,0.3)]">
					<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2.5 pt-4 px-4">
						<Card.Title class="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Total Users</Card.Title>
						<div class="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-50 text-zinc-400 dark:bg-zinc-800/60 dark:text-zinc-500">
							<Users class="h-3.5 w-3.5" />
						</div>
					</Card.Header>
					<Card.Content class="pb-4 pt-0 px-4">
						<div class="font-tabular text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{users.length}</div>
						<p class="mt-1.5 text-[10px] font-semibold">
							<a href={resolve(`/settings/banks`, {})} class="text-zinc-900 hover:text-zinc-600 dark:text-zinc-100 dark:hover:text-zinc-300 hover:underline transition-colors">Manage users →</a>
						</p>
					</Card.Content>
				</Card.Root>
			{/await}
		{:else}
			<Card.Root class="overflow-hidden border-0 bg-white dark:bg-zinc-900 shadow-[0_4px_12px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.2)] rounded-lg transition-all duration-200 hover:shadow-[0_6px_20px_rgba(0,0,0,0.05)] dark:hover:shadow-[0_6px_20px_rgba(0,0,0,0.3)]">
				<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2.5 pt-4 px-4">
					<Card.Title class="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Total Users</Card.Title>
					<div class="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-50 text-zinc-400 dark:bg-zinc-800/60 dark:text-zinc-500">
						<Users class="h-3.5 w-3.5" />
					</div>
				</Card.Header>
				<Card.Content class="pb-4 pt-0 px-4">
					<div class="font-tabular text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{totalUsers}</div>
					<p class="mt-1.5 text-[10px] font-semibold">
						<a href={resolve(`/settings/banks`, {})} class="text-zinc-900 hover:text-zinc-600 dark:text-zinc-100 dark:hover:text-zinc-300 hover:underline transition-colors">Manage users →</a>
					</p>
				</Card.Content>
			</Card.Root>
		{/if}
	{/if}

	<Card.Root class="overflow-hidden border-0 bg-white dark:bg-zinc-900 shadow-[0_4px_12px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.2)] rounded-lg transition-all duration-200 hover:shadow-[0_6px_20px_rgba(0,0,0,0.05)] dark:hover:shadow-[0_6px_20px_rgba(0,0,0,0.3)]">
		<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2.5 pt-4 px-4">
			<Card.Title class="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Total Debts</Card.Title>
			<div class="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-50 text-zinc-400 dark:bg-zinc-800/60 dark:text-zinc-500">
				<FileText class="h-3.5 w-3.5" />
			</div>
		</Card.Header>
		<Card.Content class="pb-4 pt-0 px-4">
			<div class="font-tabular text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{totalDebts}</div>
			<p class="mt-1.5 text-[10px] font-medium text-zinc-400/90">All records</p>
		</Card.Content>
	</Card.Root>

	<Card.Root class="overflow-hidden border-0 bg-white dark:bg-zinc-900 shadow-[0_4px_12px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.2)] rounded-lg transition-all duration-200 hover:shadow-[0_6px_20px_rgba(0,0,0,0.05)] dark:hover:shadow-[0_6px_20px_rgba(0,0,0,0.3)]">
		<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2.5 pt-4 px-4">
			<Card.Title class="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Pending</Card.Title>
			<div class="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-50 text-zinc-400 dark:bg-zinc-800/60 dark:text-zinc-500">
				<Clock class="h-3.5 w-3.5" />
			</div>
		</Card.Header>
		<Card.Content class="pb-4 pt-0 px-4">
			<div class="font-tabular text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{pendingDebts}</div>
			<p class="mt-1.5 text-[10px] font-medium text-zinc-400/90">Awaiting confirmation</p>
		</Card.Content>
	</Card.Root>
</div>
