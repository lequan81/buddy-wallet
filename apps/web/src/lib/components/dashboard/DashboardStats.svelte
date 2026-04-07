<script lang="ts">
	import * as Card from '@repo/ui/components/ui/card';
	import { Users, FileText, Clock } from '@repo/icons';
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
				<div class="h-32 animate-pulse rounded-xl bg-muted/50"></div>
			{:then users}
				<Card.Root>
					<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
						<Card.Title class="text-sm font-medium text-muted-foreground">Total Users</Card.Title>
						<Users class="h-4 w-4 text-muted-foreground" />
					</Card.Header>
					<Card.Content>
						<div class="font-tabular text-4xl font-bold">{users.length}</div>
						<p class="mt-1 text-xs text-muted-foreground">
							<a href={resolve(`/settings/banks`, {})} class="hover:underline">Manage users →</a>
						</p>
					</Card.Content>
				</Card.Root>
			{/await}
		{:else}
			<Card.Root>
				<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
					<Card.Title class="text-sm font-medium text-muted-foreground">Total Users</Card.Title>
					<Users class="h-4 w-4 text-muted-foreground" />
				</Card.Header>
				<Card.Content>
					<div class="font-tabular text-4xl font-bold">{totalUsers}</div>
					<p class="mt-1 text-xs text-muted-foreground">
						<a href={resolve(`/settings/banks`, {})} class="hover:underline">Manage users →</a>
					</p>
				</Card.Content>
			</Card.Root>
		{/if}
	{/if}

	<Card.Root>
		<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
			<Card.Title class="text-sm font-medium text-muted-foreground">Total Debts</Card.Title>
			<FileText class="h-4 w-4 text-muted-foreground" />
		</Card.Header>
		<Card.Content>
			<div class="font-tabular text-4xl font-bold">{totalDebts}</div>
			<p class="mt-1 text-xs text-muted-foreground">All records</p>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
			<Card.Title class="text-sm font-medium text-muted-foreground">Pending</Card.Title>
			<Clock class="h-4 w-4 text-muted-foreground" />
		</Card.Header>
		<Card.Content>
			<div class="font-tabular text-4xl font-bold">{pendingDebts}</div>
			<p class="mt-1 text-xs text-muted-foreground">Awaiting confirmation</p>
		</Card.Content>
	</Card.Root>
</div>
