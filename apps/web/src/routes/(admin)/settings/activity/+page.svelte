<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		Activity,
		LogIn,
		LogOut,
		Plus,
		Edit,
		Trash2,
		Check,
		AlertTriangle,
		FileText,
		User,
		Shield,
		ChevronLeft,
		ChevronRight
	} from '@lucide/svelte';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';

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
				return LogIn;
			case 'logout':
				return LogOut;
			case 'create':
				return Plus;
			case 'update':
				return Edit;
			case 'delete':
				return Trash2;
			case 'confirm':
			case 'paid':
				return Check;
			case 'dispute':
				return AlertTriangle;
			default:
				return Activity;
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
				return FileText;
			case 'user':
				return User;
			case 'session':
				return Shield;
			default:
				return Activity;
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

	// Pagination
	const limit = data.limit || 50;
	const offset = data.offset || 0;
	const hasMore = data.logs.length === limit;
	const hasPrev = offset > 0;

	const goToPage = (newOffset: number) => {
		goto(`/settings/activity?limit=${limit}&offset=${newOffset}`, { replaceState: true });
	};
</script>

<svelte:head>
	<title>Activity Log | Settings</title>
</svelte:head>

<div class="space-y-6">
	<div>
		<h2 class="text-2xl font-bold tracking-tight">Activity Log</h2>
		<p class="text-muted-foreground">View your recent account activity and actions.</p>
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
			<Card.Description>
				Your actions and events from the last 30 days.
			</Card.Description>
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
						{@const ActionIcon = getActionIcon(log.action)}
						{@const ResourceIcon = getResourceIcon(log.resource)}
						<div class="flex items-start gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50">
							<!-- Action Icon -->
							<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full {getActionColor(log.action)}">
								<svelte:component this={ActionIcon} class="h-5 w-5" />
							</div>

							<!-- Content -->
							<div class="min-w-0 flex-1">
								<div class="flex items-center gap-2">
									<p class="font-medium">
										{formatAction(log.action, log.resource)}
									</p>
									{#if log.resourceId}
										<span class="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
											{log.resourceId.slice(0, 8)}...
										</span>
									{/if}
								</div>

								<!-- Changes summary -->
								{#if log.changes}
									<div class="mt-1 text-sm text-muted-foreground">
										{#if log.changes.after?.status}
											Status changed to <span class="font-medium capitalize">{log.changes.after.status}</span>
										{:else if log.changes.after?.amount}
											Amount: {log.changes.after.amount}
										{/if}
									</div>
								{/if}

								<!-- Metadata -->
								<div class="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
									<span class="flex items-center gap-1">
										<svelte:component this={ResourceIcon} class="h-3 w-3" />
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
				<div class="mt-6 flex items-center justify-between border-t pt-4">
					<p class="text-sm text-muted-foreground">
						Showing {offset + 1} - {offset + data.logs.length} entries
					</p>
					<div class="flex gap-2">
						<Button
							variant="outline"
							size="sm"
							disabled={!hasPrev}
							onclick={() => goToPage(Math.max(0, offset - limit))}
						>
							<ChevronLeft class="mr-1 h-4 w-4" />
							Previous
						</Button>
						<Button
							variant="outline"
							size="sm"
							disabled={!hasMore}
							onclick={() => goToPage(offset + limit)}
						>
							Next
							<ChevronRight class="ml-1 h-4 w-4" />
						</Button>
					</div>
				</div>
			{/if}
		</Card.Content>
	</Card.Root>
</div>
