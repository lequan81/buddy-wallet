<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	// import {
	// 	Activity,
	// 	LogIn,
	// 	LogOut,
	// 	Plus,
	// 	Edit,
	// 	Trash2,
	// 	Check,
	// 	AlertTriangle,
	// 	FileText,
	// 	User,
	// 	Shield,
	// 	ChevronLeft,
	// 	ChevronRight,
	// 	ChevronsLeft,
	// 	ChevronsRight
	import * as Card from '@repo/ui/components/ui/card';
	import { Button } from '@repo/ui/components/ui/button';
	import { Separator } from '@repo/ui/components/ui/separator';

	let { data } = $props();

	const formatDate = (date: string) => {
		return new Date(date).toLocaleString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	};

	const getActionIcon = (action: string) => {
		switch (action) {
			case 'login':
				return IconLucideLogIn;
			case 'logout':
				return IconLucideLogOut;
			case 'create':
				return IconLucidePlus;
			case 'update':
				return IconLucideEdit;
			case 'delete':
				return IconLucideTrash2;
			case 'confirm':
			case 'paid':
				return IconLucideCheck;
			case 'dispute':
				return IconLucideAlertTriangle;
			default:
				return IconLucideActivity;
		}
	};

	const getActionColor = (action: string) => {
		switch (action) {
			case 'login':
				return 'text-green-600 bg-green-100 dark:bg-green-900/30';
			case 'logout':
				return 'text-orange-600 bg-orange-100 dark:bg-orange-900/30';
			case 'create':
				return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30';
			case 'update':
				return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30';
			case 'delete':
				return 'text-red-600 bg-red-100 dark:bg-red-900/30';
			case 'confirm':
			case 'paid':
				return 'text-green-600 bg-green-100 dark:bg-green-900/30';
			case 'dispute':
				return 'text-red-600 bg-red-100 dark:bg-red-900/30';
			default:
				return 'text-gray-600 bg-gray-100 dark:bg-gray-900/30';
		}
	};

	const getResourceIcon = (resource: string) => {
		switch (resource) {
			case 'debt':
				return IconLucideFileText;
			case 'user':
				return IconLucideUser;
			case 'session':
				return IconLucideShield;
			default:
				return IconLucideActivity;
		}
	};

	const formatAction = (action: string, resource: string) => {
		const actionLabels: Record<string, string> = {
			login: 'Logged in',
			logout: 'Logged out',
			create: `Created ${resource}`,
			update: `Updated ${resource}`,
			delete: `Deleted ${resource}`,
			confirm: `Confirmed ${resource}`,
			paid: `Marked ${resource} as paid`,
			dispute: `Disputed ${resource}`
		};
		return actionLabels[action] || `${action} ${resource}`;
	};

	// Pagination from server
	type ExtendedData = typeof data & {
		page?: number;
		pageSize?: number;
		pagination?: { total: number; limit: number; offset: number; hasMore: boolean };
	};
	let extData = $derived(data as ExtendedData);
	let currentPage = $derived(extData.page || 1);
	let pageSize = $derived(extData.pageSize || 20);
	let pagination = $derived(
		extData.pagination || { total: 0, limit: 20, offset: 0, hasMore: false }
	);
	let totalPages = $derived(Math.ceil(pagination.total / pageSize) || 1);

	// Navigate with pagination params
	const navigateWithParams = (params: { page?: number; pageSize?: number }) => {
		const url = new URL($page.url);
		if (params.page !== undefined) url.searchParams.set('page', params.page.toString());
		if (params.pageSize !== undefined) url.searchParams.set('pageSize', params.pageSize.toString());
		goto(url.toString(), { invalidateAll: true });
	};
</script>

<svelte:head>
	<title>Activity Log | Settings</title>
</svelte:head>

<div class="space-y-6">
	<div>
		<h3 class="text-lg font-medium">Activity Log</h3>
		<p class="text-sm text-muted-foreground">View your recent account activity and actions.</p>
	</div>

	<Separator />

	{#if data.error}
		<div class="rounded-lg bg-red-100 p-4 text-red-700 dark:bg-red-900/30 dark:text-red-300">
			{data.error}
		</div>
	{/if}

	<Card.Root>
		<Card.Header>
			<Card.Title class="flex items-center gap-2">
				<IconLucideActivity class="h-5 w-5" />
				Recent Activity
			</Card.Title>
			<Card.Description>Your actions and events from the last 30 days.</Card.Description>
		</Card.Header>
		<Card.Content>
			{#if data.logs.length === 0}
				<div class="py-12 text-center text-muted-foreground">
					<IconLucideActivity class="mx-auto mb-4 h-12 w-12 opacity-50" />
					<p>No activity recorded yet.</p>
				</div>
			{:else}
				<div class="space-y-4">
					{#each data.logs as log (log.id)}
						{@const ActionIcon = getActionIcon(log.action)}
						{@const ResourceIcon = getResourceIcon(log.resource)}
						<div
							class="flex items-start gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50"
						>
							<!-- Action Icon -->
							<div
								class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full {getActionColor(
									log.action
								)}"
							>
								<ActionIcon class="h-5 w-5" />
							</div>

							<!-- Content -->
							<div class="min-w-0 flex-1">
								<div class="flex items-center gap-2">
									<p class="font-medium">
										{formatAction(log.action, log.resource)}
									</p>
									{#if log.resourceId}
										<span
											class="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground"
										>
											{log.resourceId.slice(0, 8)}...
										</span>
									{/if}
								</div>

								<!-- Changes summary -->
								{#if log.changes}
									<div class="mt-1 text-sm text-muted-foreground">
										{#if log.changes.after?.status}
											Status changed to <span class="font-medium capitalize"
												>{log.changes.after.status}</span
											>
										{:else if log.changes.after?.amount}
											Amount: {log.changes.after.amount}
										{/if}
									</div>
								{/if}

								<!-- Metadata -->
								<div class="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
									<span class="flex items-center gap-1">
										<ResourceIcon class="h-3 w-3" />
										{log.resource}
									</span>
									{#if log.ipAddress}
										<span>IP: {log.ipAddress}</span>
									{/if}
									<span>{formatDate(log.createdAt)}</span>
								</div>
							</div>
						</div>
					{/each}
				</div>

				<!-- Pagination -->
				{#if pagination.total > 0}
					<div class="mt-6 flex items-center justify-between border-t pt-4">
						<div class="flex items-center gap-2 text-sm text-muted-foreground">
							<span>
								Showing {(currentPage - 1) * pageSize + 1} to {Math.min(
									currentPage * pageSize,
									pagination.total
								)} of {pagination.total} entries
							</span>
							<select
								class="ml-2 rounded border bg-background px-2 py-1 text-sm"
								value={pageSize}
								onchange={(e) =>
									navigateWithParams({ pageSize: parseInt(e.currentTarget.value), page: 1 })}
							>
								<option value={10}>10 per page</option>
								<option value={20}>20 per page</option>
								<option value={50}>50 per page</option>
							</select>
						</div>
						<div class="flex items-center gap-1">
							<Button
								variant="outline"
								size="icon"
								class="h-8 w-8"
								disabled={currentPage <= 1}
								onclick={() => navigateWithParams({ page: 1 })}
							>
								<IconLucideChevronsLeft class="h-4 w-4" />
							</Button>
							<Button
								variant="outline"
								size="icon"
								class="h-8 w-8"
								disabled={currentPage <= 1}
								onclick={() => navigateWithParams({ page: currentPage - 1 })}
							>
								<IconLucideChevronLeft class="h-4 w-4" />
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
								<IconLucideChevronRight class="h-4 w-4" />
							</Button>
							<Button
								variant="outline"
								size="icon"
								class="h-8 w-8"
								disabled={currentPage >= totalPages}
								onclick={() => navigateWithParams({ page: totalPages })}
							>
								<IconLucideChevronsRight class="h-4 w-4" />
							</Button>
						</div>
					</div>
				{/if}
			{/if}
		</Card.Content>
	</Card.Root>
</div>
