<script lang="ts">
	import { resolve } from '$app/paths';
	import { AlertCircle, CheckCircle, ChevronDown, ChevronUp, ExternalLink, FileSpreadsheet, Loader2, X } from '@repo/icons';
	import { goto } from '$app/navigation';
	import { importProgress } from '$lib/stores/import-progress.svelte';
	import { slide } from 'svelte/transition';
	import { Button } from '@repo/ui/components/ui/button';
	import * as Card from '@repo/ui/components/ui/card';
	import { cn } from '$lib/utils';

	let expanded = $state(true);

	// Derived state for active jobs count
	let jobs = $derived(Array.from(importProgress.activeJobs.values()));
	let processingCount = $derived(
		jobs.filter((j) => j.status === 'pending' || j.status === 'processing').length
	);
	let completedCount = $derived(jobs.filter((j) => j.status === 'success').length);
	let failedCount = $derived(jobs.filter((j) => j.status === 'failed').length);
</script>

{#if jobs.length > 0}
	<div class="fixed right-4 bottom-4 z-100 flex w-96 flex-col gap-2" transition:slide>
		<Card.Root class="border-border bg-card shadow-xl">
			<div class="flex items-center justify-between border-b border-border/50 bg-muted/50 p-3">
				<div class="flex items-center gap-2">
					{#if processingCount > 0}
						<Loader2 class="h-4 w-4 animate-spin text-primary" />
						<span class="text-sm font-medium"
							>Processing {processingCount} {processingCount === 1 ? 'job' : 'jobs'}</span
						>
					{:else if failedCount > 0 && completedCount === 0}
						<AlertCircle class="h-4 w-4 text-destructive" />
						<span class="text-sm font-medium text-destructive">Import Failed</span>
					{:else}
						<CheckCircle class="h-4 w-4 text-green-500" />
						<span class="text-sm font-medium text-green-600 dark:text-green-400"
							>Import Complete</span
						>
					{/if}
				</div>
				<div class="flex gap-1">
					<Button
						variant="ghost"
						size="icon"
						class="h-6 w-6"
						onclick={() => (expanded = !expanded)}
					>
						{#if expanded}
							<ChevronDown class="h-4 w-4" />
						{:else}
							<ChevronUp class="h-4 w-4" />
						{/if}
					</Button>
					{#if processingCount === 0}
						<Button
							variant="ghost"
							size="icon"
							class="h-6 w-6"
							onclick={() => {
								for (const job of jobs) importProgress.removeJob(job.jobId);
							}}
						>
							<X class="h-4 w-4" />
						</Button>
					{/if}
				</div>
			</div>

			{#if expanded}
				<div class="flex max-h-60 flex-col gap-2 overflow-y-auto p-2" transition:slide>
					{#each jobs as job (job.jobId)}
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class={cn(
							'flex items-start gap-3 rounded-lg border bg-background/50 p-2 text-sm transition-colors hover:bg-muted/50',
							job.status === 'success' && 'cursor-pointer'
						)}
							onclick={() => {
								if (job.status === 'success') {
									goto('/dashboard/import');
								}
							}}
						>
							<div class="mt-1">
								{#if job.status === 'processing' || job.status === 'pending'}
									<Loader2 class="h-4 w-4 animate-spin text-primary" />
								{:else if job.status === 'success'}
									<CheckCircle class="h-4 w-4 text-green-500" />
								{:else if job.status === 'failed'}
									<AlertCircle class="h-4 w-4 text-destructive" />
								{:else}
									<FileSpreadsheet class="h-4 w-4 text-muted-foreground" />
								{/if}
							</div>
							<div class="min-w-0 flex-1">
								<div class="flex items-start justify-between">
									<span class="block truncate font-medium">{job.fileName}</span>
								</div>

								<div class="mt-1 flex justify-between text-xs text-muted-foreground">
									{#if job.status === 'processing' && job.progress.total > 0}
										<span
											>Processing • {job.progress.current}/{job.progress.total} rows ({job.progress
												.percentage}%)</span
										>
									{:else if job.status === 'success'}
										<span class="text-green-600 dark:text-green-400"
											>Complete • {job.progress.current} rows imported</span
										>
									{:else if job.status === 'failed'}
										<span class="text-destructive">Failed</span>
									{:else}
										<span class="capitalize">{job.type} • {job.status}</span>
									{/if}
								</div>

								<div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
									<div
										class={cn(
											'h-full transition-all duration-300',
											(job.status === 'processing' || job.status === 'pending') && 'bg-primary',
											job.status === 'success' && 'bg-green-500',
											job.status === 'failed' && 'bg-red-500'
										)}
										style="width: {job.status === 'failed' ? 100 : job.progress.percentage}%"
									></div>
								</div>

								{#if job.error}
									<p class="mt-1 line-clamp-2 text-xs text-destructive">{job.error}</p>
								{/if}

								{#if job.status === 'success'}
									<div class="mt-1.5 flex items-center gap-1">
										<a
											href={resolve(`/dashboard/import`, {})}
											class="inline-flex items-center gap-1 text-xs font-medium text-green-600 transition-colors hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
											onclick={(e) => e.stopPropagation()}
										>
											View Details
											<ExternalLink class="h-3 w-3" />
										</a>
									</div>
								{/if}
							</div>

							<div class="-mt-1 -mr-1 flex gap-1">
								<Button
									variant="ghost"
									size="icon"
									class="h-6 w-6 text-muted-foreground hover:text-foreground"
									disabled={job.status === 'processing' || job.status === 'pending'}
									onclick={(e: MouseEvent) => {
										e.stopPropagation();
										importProgress.removeJob(job.jobId);
									}}
								>
									<X class="h-3 w-3" />
								</Button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</Card.Root>
	</div>
{/if}
