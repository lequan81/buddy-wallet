<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import * as Card from '@repo/ui/components/ui/card';
	import * as Table from '@repo/ui/components/ui/table';
	import { Button } from '@repo/ui/components/ui/button';
	import { Badge } from '@repo/ui/components/ui/badge';
	import * as Dialog from '@repo/ui/components/ui/dialog';
	import { toast } from 'svelte-sonner';

	import FileSpreadsheet from '~icons/lucide/file-spreadsheet';
	import ArrowLeft from '~icons/lucide/arrow-left';
	import Loader2 from '~icons/lucide/loader-2';
	import AlertTriangle from '~icons/lucide/alert-triangle';
	import Clock from '~icons/lucide/clock';
	import ChevronLeft from '~icons/lucide/chevron-left';
	import ChevronRight from '~icons/lucide/chevron-right';
	import Eye from '~icons/lucide/eye';

	// Types
	interface ImportLog {
		id: string;
		fileName: string;
		status: 'pending' | 'processing' | 'success' | 'failed';
		totalRows: number;
		importedCount: number;
		errorCount: number;
		errors: string | null; // JSON string
		createdAt: string;
		completedAt: string | null;
	}

	interface LogsResponse {
		success: boolean;
		logs: ImportLog[];
		total: number;
		page: number;
		limit: number;
		totalPages: number;
	}

	// State
	let loading = $state(true);
	let logs = $state<ImportLog[]>([]);
	let page = $state(1);
	let totalPages = $state(1);
	let selectedLog = $state<ImportLog | null>(null);
	let showDetails = $state(false);

	async function fetchLogs(p: number = 1) {
		loading = true;
		try {
			const res = await fetch(`/api/import/logs?page=${p}&limit=10`);
			if (res.ok) {
				const data: LogsResponse = await res.json();
				if (data.success) {
					logs = data.logs;
					page = data.page;
					totalPages = data.totalPages;
				}
			} else {
				toast.error('Failed to load import history');
			}
		} catch (err) {
			console.error(err);
			toast.error('Network error');
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		fetchLogs();
	});

	function formatDate(dateStr: string) {
		return new Date(dateStr).toLocaleString();
	}

	function getStatusColor(status: string) {
		switch (status) {
			case 'success':
				return 'bg-green-500/10 text-green-700 dark:text-green-400 hover:bg-green-500/20';
			case 'failed':
				return 'bg-destructive/10 text-destructive hover:bg-destructive/20';
			case 'processing':
				return 'bg-blue-500/10 text-blue-700 dark:text-blue-400 hover:bg-blue-500/20';
			default:
				return 'bg-muted text-muted-foreground hover:bg-muted/80';
		}
	}

	function viewDetails(log: ImportLog) {
		selectedLog = log;
		showDetails = true;
	}
</script>

<div class="container max-w-5xl space-y-6 py-10">
	<div class="flex items-center gap-4">
		<Button variant="ghost" href="/dashboard/import" size="icon">
			<ArrowLeft class="h-4 w-4" />
		</Button>
		<div>
			<h1 class="text-2xl font-bold tracking-tight">Import History</h1>
			<p class="text-muted-foreground">View status and details of past import jobs.</p>
		</div>
	</div>

	<Card.Root>
		<Card.Content class="p-0">
			<div class="relative w-full overflow-auto">
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head>File Name</Table.Head>
							<Table.Head>Status</Table.Head>
							<Table.Head>Progress</Table.Head>
							<Table.Head>Date</Table.Head>
							<Table.Head class="text-right">Actions</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#if loading}
							<Table.Row>
								<Table.Cell colspan={5} class="h-24 text-center">
									<Loader2 class="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
								</Table.Cell>
							</Table.Row>
						{:else if logs.length === 0}
							<Table.Row>
								<Table.Cell colspan={5} class="h-24 text-center text-muted-foreground">
									No import history found.
								</Table.Cell>
							</Table.Row>
						{:else}
							{#each logs as log}
								<Table.Row>
									<Table.Cell class="font-medium">
										<div class="flex items-center gap-2">
											<FileSpreadsheet class="h-4 w-4 text-muted-foreground" />
											{log.fileName}
										</div>
									</Table.Cell>
									<Table.Cell>
										<Badge variant="outline" class={getStatusColor(log.status)}>
											{log.status}
										</Badge>
									</Table.Cell>
									<Table.Cell>
										<div class="text-sm">
											{#if log.status === 'success'}
												<span class="text-green-600 dark:text-green-400">{log.importedCount}</span>
												/ {log.totalRows}
											{:else if log.status === 'failed'}
												<span class="text-destructive">Failed</span>
											{:else}
												Processing...
											{/if}
										</div>
										{#if log.errorCount > 0}
											<div class="mt-0.5 flex items-center gap-1 text-xs text-destructive">
												<AlertTriangle class="h-3 w-3" />
												{log.errorCount} warnings
											</div>
										{/if}
									</Table.Cell>
									<Table.Cell class="text-xs text-muted-foreground">
										<div class="flex items-center gap-1">
											<Clock class="h-3 w-3" />
											{formatDate(log.createdAt)}
										</div>
									</Table.Cell>
									<Table.Cell class="text-right">
										<Button variant="ghost" size="icon" onclick={() => viewDetails(log)}>
											<Eye class="h-4 w-4" />
										</Button>
									</Table.Cell>
								</Table.Row>
							{/each}
						{/if}
					</Table.Body>
				</Table.Root>
			</div>

			<!-- Pagination -->
			<div class="flex items-center justify-end space-x-2 p-4">
				<Button
					variant="outline"
					size="sm"
					onclick={() => fetchLogs(page - 1)}
					disabled={page <= 1 || loading}
				>
					<ChevronLeft class="h-4 w-4" />
					Previous
				</Button>
				<div class="text-sm text-muted-foreground">
					Page {page} of {totalPages}
				</div>
				<Button
					variant="outline"
					size="sm"
					onclick={() => fetchLogs(page + 1)}
					disabled={page >= totalPages || loading}
				>
					Next
					<ChevronRight class="h-4 w-4" />
				</Button>
			</div>
		</Card.Content>
	</Card.Root>
</div>

<!-- Details Dialog -->
<Dialog.Root bind:open={showDetails}>
	<Dialog.Content class="max-h-[80vh] max-w-3xl overflow-y-auto">
		<Dialog.Header>
			<Dialog.Title>Import Details</Dialog.Title>
			<Dialog.Description>
				Log ID: {selectedLog?.id}
			</Dialog.Description>
		</Dialog.Header>

		{#if selectedLog}
			<div class="space-y-4">
				<div class="grid grid-cols-2 gap-4 text-sm">
					<div>
						<span class="text-muted-foreground">File:</span>
						<p class="font-medium">{selectedLog.fileName}</p>
					</div>
					<div>
						<span class="text-muted-foreground">Status:</span>
						<p class="font-medium capitalize">{selectedLog.status}</p>
					</div>
					<div>
						<span class="text-muted-foreground">Total Rows:</span>
						<p class="font-medium">{selectedLog.totalRows}</p>
					</div>
					<div>
						<span class="text-muted-foreground">Imported:</span>
						<p class="font-medium">{selectedLog.importedCount}</p>
					</div>
				</div>

				{#if selectedLog.errors}
					{@const errors = JSON.parse(selectedLog.errors)}
					{#if Array.isArray(errors) && errors.length > 0}
						<div class="rounded-md border border-destructive/20 bg-destructive/10 p-4">
							<h4 class="mb-2 flex items-center gap-2 font-semibold text-destructive">
								<AlertTriangle class="h-4 w-4" /> Errors / Warnings ({errors.length})
							</h4>
							<ul
								class="max-h-60 list-inside list-disc space-y-1 overflow-y-auto text-sm text-destructive/90"
							>
								{#each errors as error}
									<li>{error}</li>
								{/each}
							</ul>
						</div>
					{/if}
				{/if}
			</div>
		{/if}
	</Dialog.Content>
</Dialog.Root>
