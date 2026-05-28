<script lang="ts">
	import { resolve } from '$app/paths';
	import ChevronLeft from '~icons/lucide/chevron-left';
import ChevronRight from '~icons/lucide/chevron-right';
import ChevronsLeft from '~icons/lucide/chevrons-left';
import ChevronsRight from '~icons/lucide/chevrons-right';
import Eye from '~icons/lucide/eye';
import Phone from '~icons/lucide/phone';
import Search from '~icons/lucide/search';
import User from '~icons/lucide/user';
import UserCheck from '~icons/lucide/user-check';
import UserX from '~icons/lucide/user-x';

	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { useDebounce } from '$lib/hooks/use-debounce.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Select from '$lib/components/ui/select';
	import { cn } from '$lib/utils';

	import { type PageData } from './$types';
	let { data } = $props<{ data: PageData }>();

	let searchQuery = $state('');
	let filterStatus = $state<'all' | 'active' | 'inactive'>('all');

	// Pagination from server
	type ExtendedData = typeof data & {
		page?: number;
		pageSize?: number;
		pagination?: { total: number; limit: number; offset: number; hasMore: boolean };
	};
	let extData = $derived(data as ExtendedData);
	let currentPage = $derived(extData.page || 1);
	let pageSize = $derived(extData.pageSize || 10);
	let pagination = $derived(
		extData.pagination || { total: 0, limit: 10, offset: 0, hasMore: false }
	);
	let totalPages = $derived(Math.ceil(pagination.total / pageSize) || 1);

	// Navigate with pagination params
	const navigateWithParams = (params: { page?: number; pageSize?: number }) => {
		const url = new URL($page.url);
		if (params.page !== undefined) url.searchParams.set('page', params.page.toString());
		if (params.pageSize !== undefined) url.searchParams.set('pageSize', params.pageSize.toString());
		goto(url.toString());
	};

	// Debounce search query to avoid filtering on every keystroke
	const debouncedSearch = useDebounce(() => searchQuery, 300);

	// Client-side filtering (on top of server-paginated data)
	type UserItem = NonNullable<typeof data.users>[number];
	const filteredUsers = $derived(() => {
		let users = data.users ?? [];

		if (debouncedSearch.debounced()) {
			const q = debouncedSearch.debounced().toLowerCase();
			users = users.filter(
				(u: UserItem) =>
					u.name?.toLowerCase().includes(q) ||
					u.email?.toLowerCase().includes(q) ||
					u.phoneNumber?.includes(q)
			);
		}

		if (filterStatus === 'active') {
			users = users.filter((u: UserItem) => u.isActive !== false);
		} else if (filterStatus === 'inactive') {
			users = users.filter((u: UserItem) => u.isActive === false);
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
			<User class="h-8 w-8 text-primary" />
			User Management
		</h1>
		<p class="mt-2 text-muted-foreground">View and manage all registered users</p>
	</div>

	<!-- Filters -->
	<div class="mb-6 flex flex-wrap gap-4">
		<div class="relative min-w-64 flex-1">
			<Search
				class="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
			/>
			<input
				type="text"
				placeholder="Search by name, email, or phone..."
				bind:value={searchQuery}
				class="w-full rounded-lg border bg-background py-2 pr-4 pl-10 outline-none focus:ring-2 focus:ring-primary/50"
			/>
		</div>
		<Select.Root bind:value={filterStatus}>
			<Select.Trigger class="w-auto rounded-lg border px-4 py-2">
				<Select.Value />
			</Select.Trigger>
			<Select.Content>
				<Select.Item value="all" label="All Users" />
				<Select.Item value="active" label="Active Only" />
				<Select.Item value="inactive" label="Inactive Only" />
			</Select.Content>
		</Select.Root>
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
									<p class="text-sm text-muted-foreground">
										<Phone
											class="mr-1 inline-block h-5 w-5 align-middle text-muted-foreground"
										/>{user.email ?? ''}
									</p>
								</div>
							</td>
							<td class="px-6 py-4 text-sm">
								{user.phoneNumber || '—'}
							</td>
							<td class="px-6 py-4">
								<span
									class={cn(
										'rounded-full px-2 py-1 text-xs font-medium capitalize',
										user.role === 'admin'
											? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
											: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
									)}
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
									href={resolve(`/admin/users/${user.id}`, {})}
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

	<!-- Pagination Controls -->
	{#if pagination.total > 0}
		<div class="mt-6 flex items-center justify-between">
			<div class="flex items-center gap-2 text-sm text-muted-foreground">
				<span>
					Showing {(currentPage - 1) * pageSize + 1} to {Math.min(
						currentPage * pageSize,
						pagination.total
					)} of {pagination.total} users
				</span>
				<Select.Root
					value={pageSize.toString()}
					onValueChange={(v) =>
						navigateWithParams({ pageSize: parseInt(v), page: 1 })}
				>
					<Select.Trigger class="ml-2 h-8 w-auto rounded border px-2 py-1 text-sm">
						<Select.Value />
					</Select.Trigger>
					<Select.Content>
						<Select.Item value="5" label="5 per page" />
						<Select.Item value="10" label="10 per page" />
						<Select.Item value="25" label="25 per page" />
						<Select.Item value="50" label="50 per page" />
					</Select.Content>
				</Select.Root>
			</div>
			<div class="flex items-center gap-1">
				<Button
					variant="outline"
					size="icon"
					class="h-8 w-8"
					disabled={currentPage <= 1}
					onclick={() => navigateWithParams({ page: 1 })}
				>
					<ChevronsLeft class="h-4 w-4" />
				</Button>
				<Button
					variant="outline"
					size="icon"
					class="h-8 w-8"
					disabled={currentPage <= 1}
					onclick={() => navigateWithParams({ page: currentPage - 1 })}
				>
					<ChevronLeft class="h-4 w-4" />
				</Button>
				<span class="px-3 text-sm">
					Page {currentPage} of {totalPages}
				</span>
				<Button
					variant="outline"
					size="icon"
					class="h-8 w-8"
					disabled={currentPage >= totalPages}
					onclick={() => navigateWithParams({ page: currentPage + 1 })}
				>
					<ChevronRight class="h-4 w-4" />
				</Button>
				<Button
					variant="outline"
					size="icon"
					class="h-8 w-8"
					disabled={currentPage >= totalPages}
					onclick={() => navigateWithParams({ page: totalPages })}
				>
					<ChevronsRight class="h-4 w-4" />
				</Button>
			</div>
		</div>
	{:else}
		<div class="mt-6 text-sm text-muted-foreground">No users found</div>
	{/if}
</div>
