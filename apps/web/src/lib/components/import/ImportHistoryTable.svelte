<script lang="ts">
	import { Loader2, Eye, FileSpreadsheet, Settings2, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from '@repo/icons';
	import { Button } from '@repo/ui/components/ui/button';
	import { Badge } from '@repo/ui/components/ui/badge';
	import * as Table from '@repo/ui/components/ui/table';
	import { Progress } from '@repo/ui/components/ui/progress';
	import ConnectionFallback from '$lib/components/shared/ConnectionFallback.svelte';
	import { cn } from '$lib/utils';
	import { getImportStatusColor, formatDate } from '$lib/utils/status';
	import type { ImportLog } from '@repo/types';

	let {
		logs,
		loadingHistory,
		historyPage,
		totalHistoryPages,
		connectionError,
		showConnectionFallback,
		importProgress, 
		onFetchLogs,
		onViewDetails
	}: {
		logs: ImportLog[];
		loadingHistory: boolean;
		historyPage: number;
		totalHistoryPages: number;
		connectionError: string;
		showConnectionFallback: boolean;
		importProgress: any;
		onFetchLogs: (page: number) => void;
		onViewDetails: (log: ImportLog) => void;
	} = $props();

	function buildPageItems(current: number, total: number) {
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
	}

	let pageItems = $derived(buildPageItems(historyPage, totalHistoryPages));
	let jumpPage = $state('');

	function handleJump() {
		const target = parseInt(jumpPage, 10);
		if (!Number.isFinite(target)) return;
		jumpPage = '';
		onFetchLogs(target);
	}

	function getEffectiveStatus(log: ImportLog) {
		// If success but no rows imported, it means it's still at preview stage
		if (log.status === 'success' && ((log.importedCount ?? 0) === 0 && (log.errorCount ?? 0) === 0)) {
			return { label: 'waiting', color: 'text-yellow-600', canResume: true };
		}
		if (log.status === 'preview' || log.status === 'pending' || log.status === 'queued') {
			return { label: 'waiting', color: 'text-yellow-600', canResume: true };
		}
		return { 
			label: log.status === 'success' ? 'done' : log.status, 
			color: getImportStatusColor(log.status),
			canResume: log.status === 'failed'
		};
	}
</script>

<Table.Root>
	<Table.Body>
		{#if showConnectionFallback}
			<Table.Row>
				<Table.Cell colspan={3} class="p-4">
					<ConnectionFallback
						onRetry={() => onFetchLogs(historyPage)}
						onUseOffline={() => {}}
						isRetrying={false}
						errorMessage={connectionError}
						timeoutSeconds={15}
					/>
				</Table.Cell>
			</Table.Row>
		{:else if loadingHistory && logs.length === 0}
			<Table.Row>
				<Table.Cell class="h-24 text-center">
					<Loader2 class="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
				</Table.Cell>
			</Table.Row>
		{:else if logs.length === 0}
			<Table.Row>
				<Table.Cell class="h-24 text-center text-sm text-muted-foreground">
					No imports yet.
				</Table.Cell>
			</Table.Row>
		{:else}
			{#each logs as log}
				{@const activeJob = importProgress.getJob(log.id)}
				<Table.Row class="group transition-colors hover:bg-muted/50">
					<Table.Cell class="py-3 align-top">
						<div class="flex w-full flex-col gap-1.5 pr-1">
							<div class="flex items-start justify-between gap-2">
								<button
									type="button"
									class="max-w-[140px] cursor-pointer truncate border-0 bg-transparent p-0 text-left text-xs leading-tight font-medium hover:text-primary transition-colors"
									title={log.fileName}
									onclick={() => onViewDetails(log)}
								>
									{log.fileName}
									<div class="mt-0.5 text-[10px] font-normal text-muted-foreground">
										{formatDate(log.createdAt)}
									</div>
								</button>
								<div class="flex items-start gap-2">
									<Badge
										variant="outline"
										class={cn(
											'h-4 cursor-default px-1.5 py-0 text-[10px] tracking-wider uppercase font-semibold',
											getEffectiveStatus(log).color
										)}
									>
										{getEffectiveStatus(log).label}
									</Badge>

									<!-- Enhanced Action Buttons -->
									<div class="ml-2 flex gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
										{#if getEffectiveStatus(log).canResume}
											<Button
												variant="ghost"
												size="icon"
												class="h-6 w-6 text-primary"
												title="Continue Mapping"
												onclick={() => window.open(`/dashboard/preview/${log.id}`, '_self')}
											>
												<Settings2 class="h-3.5 w-3.5" />
											</Button>
										{/if}

										{#if log.status === 'success' && log.previewLogId}
											<Button
												variant="ghost"
												size="icon"
												class="h-6 w-6"
												title="View Import Results"
												onclick={() => window.open(`/dashboard/import?log=${log.id}`, '_blank')}
											>
												<Eye class="h-3.5 w-3.5" />
											</Button>
										{/if}

										{#if log.importedCount > 0}
											<Button
												variant="ghost"
												size="icon"
												class="h-6 w-6"
												title="View Imported Debts"
												onclick={() => window.open(`/debts?import=${log.previewLogId}`, '_blank')}
											>
												<FileSpreadsheet class="h-3.5 w-3.5" />
											</Button>
										{/if}
									</div>
								</div>
							</div>

							{#if activeJob && (activeJob.status === 'processing' || activeJob.status === 'pending' || activeJob.status === 'queued')}
								<div class="w-full space-y-1 mt-1">
									<div class="flex items-center justify-between">
										<span class="text-[10px] text-muted-foreground font-medium">
											{activeJob.status === 'processing'
												? 'Processing'
												: activeJob.status === 'queued'
													? 'Queued'
													: 'Pending'}
										</span>
										<span class="text-[10px] text-muted-foreground">
											{activeJob.progress?.percentage || 0}%
										</span>
									</div>
									<Progress value={activeJob.progress?.percentage || 0} class="h-1" />
									{#if activeJob.message}
										<p class="text-[10px] text-muted-foreground truncate" title={activeJob.message}>
											{activeJob.message}
										</p>
									{/if}
								</div>
							{/if}
						</div>
					</Table.Cell>
				</Table.Row>
			{/each}
		{/if}
	</Table.Body>
</Table.Root>

{#if logs.length > 0}
	<div class="flex flex-wrap items-center justify-between gap-3 border-t border-border/40 px-4 py-3 bg-muted/20">
		<div class="flex items-center gap-1">
			<Button
				variant="outline"
				size="icon"
				class="h-8 w-8"
				disabled={historyPage <= 1 || loadingHistory}
				onclick={() => onFetchLogs(1)}
			>
				<ChevronsLeft class="h-4 w-4" />
			</Button>
			<Button
				variant="outline"
				size="icon"
				class="h-8 w-8"
				disabled={historyPage <= 1 || loadingHistory}
				onclick={() => onFetchLogs(historyPage - 1)}
			>
				<ChevronLeft class="h-4 w-4" />
			</Button>
			<div class="flex items-center gap-1 mx-1">
				{#each pageItems as item}
					{#if item === 'ellipsis'}
						<span class="px-1 text-sm text-muted-foreground tracking-tighter">...</span>
					{:else}
						<Button
							variant={item === historyPage ? 'default' : 'outline'}
							size="sm"
							class="h-8 min-w-8 px-2 text-xs"
							disabled={loadingHistory}
							onclick={() => onFetchLogs(item as number)}
						>
							{item}
						</Button>
					{/if}
				{/each}
			</div>
			<Button
				variant="outline"
				size="icon"
				class="h-8 w-8"
				disabled={historyPage >= totalHistoryPages || loadingHistory}
				onclick={() => onFetchLogs(historyPage + 1)}
			>
				<ChevronRight class="h-4 w-4" />
			</Button>
			<Button
				variant="outline"
				size="icon"
				class="h-8 w-8"
				disabled={historyPage >= totalHistoryPages || loadingHistory}
				onclick={() => onFetchLogs(totalHistoryPages)}
			>
				<ChevronsRight class="h-4 w-4" />
			</Button>
		</div>

		<div class="flex items-center gap-2">
			<span class="text-xs text-muted-foreground font-medium">Go to</span>
			<select
				value={jumpPage} 
				onchange={(e: Event) => {
					jumpPage = (e.target as HTMLSelectElement).value;
					handleJump();
				}}
				class="h-8 rounded-md border border-input bg-background px-2 py-1 text-xs text-muted-foreground focus:ring-1 focus:ring-primary focus:outline-none"
			>
				{#each Array(totalHistoryPages) as _, i}
					<option value={i + 1}>{i + 1}</option>
				{/each}
			</select>
		</div>
	</div>
{/if}
