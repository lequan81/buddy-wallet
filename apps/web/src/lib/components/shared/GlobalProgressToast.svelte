<script lang="ts">
	import { importProgress } from '$lib/stores/import-progress.svelte';
	import { slide } from 'svelte/transition';
	import { Button } from '@repo/ui/components/ui/button';
	import * as Card from '@repo/ui/components/ui/card';
	import Loader2 from '~icons/lucide/loader-2';
	import X from '~icons/lucide/x';
	import CheckCircle from '~icons/lucide/check-circle';
	import AlertCircle from '~icons/lucide/alert-circle';
	import FileSpreadsheet from '~icons/lucide/file-spreadsheet';
	import ChevronDown from '~icons/lucide/chevron-down';
	import ExternalLink from '~icons/lucide/external-link';
	import ChevronUp from '~icons/lucide/chevron-up';

	let expanded = $state(true);

	// Derived state for active jobs count
	let jobs = $derived(Array.from(importProgress.activeJobs.values()));
	let processingCount = $derived(
		jobs.filter((j) => j.status === 'pending' || j.status === 'processing').length
	);
</script>

{#if jobs.length > 0}
	<div class="fixed right-4 bottom-4 z-100 flex w-96 flex-col gap-2" transition:slide>
		<Card.Root class="border-border bg-card shadow-xl">
			<div class="flex items-center justify-between border-b border-border/50 bg-muted/50 p-3">
				<div class="flex items-center gap-2">
					{#if processingCount > 0}
						<Loader2 class="h-4 w-4 animate-spin text-primary" />
						<span class="text-sm font-medium">{processingCount} Processing</span>
					{:else}
						<CheckCircle class="h-4 w-4 text-green-500" />
						<span class="text-sm font-medium text-green-600 dark:text-green-400">All Complete</span>
					{/if}
				</div>
				<div class="flex gap-1">
					<Button
						variant="ghost"
						size="icon"
						class="h-6 w-6"
						onclick={() => (expanded = !expanded)}
					>
						<span class="text-xs">{expanded ? '▼' : '▲'}</span>
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
							class="flex items-start gap-3 rounded-lg border bg-background/50 p-2 text-sm transition-colors hover:bg-muted/50"
							class:cursor-pointer={job.status === 'success' && job.type === 'preview'}
							onclick={() => {
								if (job.status === 'success' && job.type === 'preview') {
									window.location.href = '/dashboard/import';
								}
							}}
						>
							<div class="mt-1">
								<FileSpreadsheet class="h-4 w-4 text-muted-foreground" />
							</div>
							<div class="min-w-0 flex-1">
								<div class="flex items-start justify-between">
									<span class="block truncate font-medium">{job.fileName}</span>
								</div>

								<div class="mt-1 flex justify-between text-xs text-muted-foreground">
									<span class="capitalize">{job.type} • {job.status}</span>
									<span>{job.progress.percentage}%</span>
								</div>

								<div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
									<div
										class="h-full bg-primary transition-all duration-300"
										class:bg-green-500={job.status === 'success'}
										class:bg-red-500={job.status === 'failed'}
										style="width: {job.progress.percentage}%"
									></div>
								</div>

								{#if job.error}
									<p class="mt-1 line-clamp-2 text-xs text-destructive">{job.error}</p>
								{/if}
							</div>

							<div class="-mt-1 -mr-1 flex gap-1">
								{#if job.status === 'success' && job.type === 'preview'}
									<Button
										variant="ghost"
										size="sm"
										class="h-6 px-2 text-xs text-green-600 hover:bg-green-50 hover:text-green-700"
										href="/dashboard/import"
										onclick={(e) => e.stopPropagation()}
									>
										View
										<ExternalLink class="ml-1 h-3 w-3" />
									</Button>
								{/if}
								<Button
									variant="ghost"
									size="icon"
									class="h-6 w-6 text-muted-foreground hover:text-foreground"
									disabled={job.status === 'processing' || job.status === 'pending'}
									onclick={(e) => {
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
