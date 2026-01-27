<script lang="ts">
	import { enhance } from '$app/forms';
	import { Users, UserCheck, UserX, Eye, Search } from '@lucide/svelte';
	import { useDebounce } from '$lib/hooks/use-debounce.svelte';

	let { data } = $props();

	let searchQuery = $state('');
	let filterStatus = $state<'all' | 'active' | 'inactive'>('all');

	// Debounce search query to avoid filtering on every keystroke
	const debouncedSearch = useDebounce(() => searchQuery, 300);

	const filteredUsers = $derived(() => {
		let users = data.users ?? [];

		if (debouncedSearch.current) {
			const q = debouncedSearch.current.toLowerCase();
			users = users.filter(
				(u: any) =>
					u.name?.toLowerCase().includes(q) ||
					u.email?.toLowerCase().includes(q) ||
					u.phoneNumber?.includes(q)
			);
		}

		if (filterStatus === 'active') {
			users = users.filter((u: any) => u.isActive !== false);
		} else if (filterStatus === 'inactive') {
			users = users.filter((u: any) => u.isActive === false);
		}

		return users;
	});
</script>

<svelte:head>
	<title>User Management | Dashboard</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<div class="mb-8">
		<h1 class="flex items-center gap-3 text-3xl font-bold">
			<Users class="h-8 w-8 text-primary" />
			User Management
		</h1>
		<p class="mt-2 text-muted-foreground">View and manage all registered users</p>
	</div>

	<!-- Filters -->
	<div class="mb-6 flex flex-wrap gap-4">
		<div class="relative min-w-64 flex-1">
			<Search class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
			<input
				type="text"
				placeholder="Search by name, email, or phone..."
				bind:value={searchQuery}
				class="w-full rounded-lg border bg-background py-2 pr-4 pl-10 outline-none focus:ring-2 focus:ring-primary/50"
			/>
		</div>
		<select
			bind:value={filterStatus}
			class="rounded-lg border bg-background px-4 py-2 outline-none focus:ring-2 focus:ring-primary/50"
		>
			<option value="all">All Users</option>
			<option value="active">Active Only</option>
			<option value="inactive">Inactive Only</option>
		</select>
	</div>

	<!-- Users Table -->
	<div class="overflow-hidden rounded-xl border bg-card shadow-sm">
		<div class="overflow-x-auto">
			<table class="w-full">
				<thead class="bg-muted/50">
					<tr>
						<th class="px-6 py-4 text-left text-sm font-semibold">User</th>
						<th class="px-6 py-4 text-left text-sm font-semibold">Phone</th>
						<th class="px-6 py-4 text-left text-sm font-semibold">Role</th>
						<th class="px-6 py-4 text-left text-sm font-semibold">Status</th>
						<th class="px-6 py-4 text-right text-sm font-semibold">Actions</th>
					</tr>
				</thead>
				<tbody class="divide-y">
					{#each filteredUsers() as user (user.id)}
						<tr class="transition-colors hover:bg-muted/30">
							<td class="px-6 py-4">
								<div>
									<p class="font-medium">{user.name || 'No name'}</p>
									<p class="text-sm text-muted-foreground">{user.email}</p>
								</div>
							</td>
							<td class="px-6 py-4 text-sm">
								{user.phoneNumber || '—'}
							</td>
							<td class="px-6 py-4">
								<span
									class="rounded-full px-2 py-1 text-xs font-medium capitalize
									{user.role === 'admin'
										? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
										: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}"
								>
									{user.role}
								</span>
							</td>
							<td class="px-6 py-4">
								{#if user.isActive !== false}
									<span class="flex items-center gap-1 text-green-600 dark:text-green-400">
										<UserCheck class="h-4 w-4" />
										Active
									</span>
								{:else}
									<span class="flex items-center gap-1 text-red-600 dark:text-red-400">
										<UserX class="h-4 w-4" />
										Inactive
									</span>
								{/if}
							</td>
							<td class="px-6 py-4 text-right">
								<a
									href="/dashboard/users/{user.id}"
									class="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
								>
									<Eye class="h-4 w-4" />
									View
								</a>
							</td>
						</tr>
					{:else}
						<tr>
							<td colspan="5" class="px-6 py-12 text-center text-muted-foreground">
								No users found matching your criteria
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>

	<!-- Summary -->
	<div class="mt-6 text-sm text-muted-foreground">
		Showing {filteredUsers().length} of {data.users?.length ?? 0} users
	</div>
</div>
