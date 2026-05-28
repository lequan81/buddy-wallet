<script lang="ts">
	import Activity from '~icons/lucide/activity';
import AlertTriangle from '~icons/lucide/alert-triangle';
import Check from '~icons/lucide/check';
import Edit from '~icons/lucide/edit';
import FileText from '~icons/lucide/file-text';
import LogIn from '~icons/lucide/log-in';
import LogOut from '~icons/lucide/log-out';
import Plus from '~icons/lucide/plus';
import Shield from '~icons/lucide/shield';
import Trash2 from '~icons/lucide/trash-2';
import User from '~icons/lucide/user';
import ChevronLeft from '~icons/lucide/chevron-left';
import ChevronRight from '~icons/lucide/chevron-right';
import ChevronsLeft from '~icons/lucide/chevrons-left';
import ChevronsRight from '~icons/lucide/chevrons-right';
	import { formatDate } from '@repo/utils/format';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import * as Select from '$lib/components/ui/select';
	import { cn } from '$lib/utils';

	let { data } = $props();

	// Unified action config -- replaces 3 separate switch statements
	const ACTION_CONFIG: Record<string, { icon: typeof Activity; color: string }> = {
		login:   { icon: LogIn,         color: 'text-green-600 bg-green-100 dark:bg-green-900/30' },
		logout:  { icon: LogOut,        color: 'text-orange-600 bg-orange-100 dark:bg-orange-900/30' },
		create:  { icon: Plus,          color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30' },
		update:  { icon: Edit,          color: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30' },
		delete:  { icon: Trash2,        color: 'text-red-600 bg-red-100 dark:bg-red-900/30' },
		confirm: { icon: Check,         color: 'text-green-600 bg-green-100 dark:bg-green-900/30' },
		paid:    { icon: Check,         color: 'text-green-600 bg-green-100 dark:bg-green-900/30' },
		dispute: { icon: AlertTriangle, color: 'text-red-600 bg-red-100 dark:bg-red-900/30' },
	};

	const DEFAULT_ACTION = { icon: Activity, color: 'text-gray-600 bg-gray-100 dark:bg-gray-900/30' };

	const RESOURCE_ICONS: Record<string, typeof Activity> = {
		debt: FileText,
		user: User,
		session: Shield,
	};

	const getActionConfig = (action: string) => ACTION_CONFIG[action] || DEFAULT_ACTION;
	const getResourceIcon = (resource: string) => RESOURCE_ICONS[resource] || Activity;

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
	let totalPages = $derived(Math.max(1, Math.ceil(pagination.total / pageSize) || 1));

	const buildPageItems = (current: number, total: number) => {
		if (total <= 1) return [1];
		const set = new Set<number>([1, total, current - 1, current, current + 1]);
		const pages = Array.from(set)
			.filter((p) => p >= 1 && p <= total)
			.sort((a, b) => a - b);
		const items: Array<number | 'ellipsis'> = [];
		for (let i = 0; i < pages.length; i++) {
			const pageNum = pages[i];
			const prev = pages[i - 1];
			if (i > 0 && prev !== undefined && pageNum - prev > 1) {
				items.push('ellipsis');
			}
			items.push(pageNum);
		}
		return items;
	};

	let jumpPage = $state('');

	const clampPage = (value: number, total: number) => {
		if (!Number.isFinite(value)) return 1;
		return Math.min(Math.max(1, value), total);
	};

	const jumpToPage = (totalPagesValue: number) => {
		const target = parseInt(jumpPage, 10);
		if (!Number.isFinite(target)) return;
		jumpPage = '';
		navigateWithParams({ page: clampPage(target, totalPagesValue) });
	};

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
				<Activity class="h-5 w-5" />
				Recent Activity
			</Card.Title>
			<Card.Description>Your actions and events from the last 30 days.</Card.Description>
		</Card.Header>
		<Card.Content>
			{#if data.logs.length === 0}
				<div class="py-12 text-center text-muted-foreground">
					<Activity class="mx-auto mb-4 h-12 w-12 opacity-50" />
					<p>No activity recorded yet.</p>
				</div>
			{:else}
				<div class="space-y-4">
					{#each data.logs as log (log.id)}
						{@const actionCfg = getActionConfig(log.action)}
						{@const ActionIcon = actionCfg.icon}
						{@const ResourceIcon = getResourceIcon(log.resource)}
						<div
							class="flex items-start gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50"
						>
							<!-- Action Icon -->
							<div
								class={cn(
									'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
									getActionConfig(log.action).color
								)}
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
									{@const after = log.changes.after as Record<string, unknown> | undefined}
									<div class="mt-1 text-sm text-muted-foreground">
										{#if after?.status}
											Status changed to <span class="font-medium capitalize"
												>{after.status}</span
											>
										{:else if after?.amount}
											Amount: {after.amount}
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
					{@const pageItems = buildPageItems(currentPage, totalPages)}
					<div class="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
						<div class="flex items-center gap-2 text-sm text-muted-foreground">
							<span>
								Showing {(currentPage - 1) * pageSize + 1} to {Math.min(
									currentPage * pageSize,
									pagination.total
								)} of {pagination.total} entries
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
									<Select.Item value="10" label="10 per page" />
									<Select.Item value="20" label="20 per page" />
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
							{#each pageItems as item, index (index)}
								{#if item === 'ellipsis'}
									<span class="px-2 text-sm text-muted-foreground">...</span>
								{:else}
									<Button
										variant={item === currentPage ? 'default' : 'outline'}
										size="sm"
										class="h-8 min-w-8 px-2"
										onclick={() => navigateWithParams({ page: item })}
									>
										{item}
									</Button>
								{/if}
							{/each}
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
						<div class="flex items-center gap-2">
							<span class="text-xs text-muted-foreground">Go to</span>
							<input
								type="number"
								min={1}
								max={totalPages}
								placeholder={currentPage.toString()}
								class="h-8 w-16 rounded border bg-background px-2 py-1 text-xs"
								bind:value={jumpPage}
								onkeydown={(event) => {
									if (event.key === 'Enter') {
										jumpToPage(totalPages);
									}
								}}
							/>
							<Button
								variant="outline"
								size="sm"
								class="h-8"
								onclick={() => jumpToPage(totalPages)}
							>
								Go
							</Button>
						</div>
					</div>
				{/if}
			{/if}
		</Card.Content>
	</Card.Root>
</div>
