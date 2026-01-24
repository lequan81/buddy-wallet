<script lang="ts">
	import { enhance } from '$app/forms';
	import { Users, UserCheck, UserX, Eye, Search } from '@lucide/svelte';

	let { data } = $props();

	let searchQuery = $state('');
	let filterStatus = $state<'all' | 'active' | 'inactive'>('all');

	const filteredUsers = $derived(() => {
		let users = data.users ?? [];
		
		if (searchQuery) {
			const q = searchQuery.toLowerCase();
			users = users.filter((u: any) => 
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
		<h1 class="text-3xl font-bold flex items-center gap-3">
			<Users class="h-8 w-8 text-primary" />
			User Management
		</h1>
		<p class="text-muted-foreground mt-2">View and manage all registered users</p>
	</div>

	<!-- Filters -->
	<div class="mb-6 flex flex-wrap gap-4">
		<div class="relative flex-1 min-w-64">
			<Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
			<input
				type="text"
				placeholder="Search by name, email, or phone..."
				bind:value={searchQuery}
				class="w-full pl-10 pr-4 py-2 rounded-lg border bg-background focus:ring-2 focus:ring-primary/50 outline-none"
			/>
		</div>
		<select 
			bind:value={filterStatus}
			class="px-4 py-2 rounded-lg border bg-background focus:ring-2 focus:ring-primary/50 outline-none"
		>
			<option value="all">All Users</option>
			<option value="active">Active Only</option>
			<option value="inactive">Inactive Only</option>
		</select>
	</div>

	<!-- Users Table -->
	<div class="bg-card rounded-xl border shadow-sm overflow-hidden">
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
						<tr class="hover:bg-muted/30 transition-colors">
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
								<span class="px-2 py-1 rounded-full text-xs font-medium capitalize
									{user.role === 'admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}">
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
									class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
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
