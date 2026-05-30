<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import FileSpreadsheet from '~icons/lucide/file-spreadsheet';
import Settings2 from '~icons/lucide/settings-2';
import Eye from '~icons/lucide/eye';
	import type { ImportLog } from '@repo/types/shared/import';
	import { formatDate } from '$lib/utils/status';
	import { goto } from '$app/navigation';

	let {
		selectedLog = $bindable(),
		showDetails = $bindable()
	}: {
		selectedLog: ImportLog | null;
		showDetails: boolean;
	} = $props();

	function close() {
		showDetails = false;
	}
</script>

<Dialog.Root bind:open={showDetails}>
	<Dialog.Content class="max-w-4xl">
		<Dialog.Header>
			<Dialog.Title class="flex items-center gap-2">
				Import Details: {selectedLog?.fileName}
				{#if selectedLog?.status === 'success' && selectedLog?.previewLogId}
					<Button
						variant="ghost"
						size="icon"
						onclick={() => {
							if (selectedLog) {
								window.open(`/dashboard/import?log=${selectedLog.id}`, '_blank');
							}
						}}
						class="ml-auto"
					>
						<FileSpreadsheet class="h-4 w-4" />
					</Button>
				{/if}
			</Dialog.Title>
		</Dialog.Header>
		
		{#if selectedLog}
			<div class="mt-4 grid grid-cols-2 gap-4 text-sm lg:grid-cols-3">
				<div class="space-y-1">
					<p class="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Status</p>
					<p class="font-medium capitalize">{selectedLog.status}</p>
				</div>
				<div class="space-y-1">
					<p class="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Created</p>
					<p class="font-medium">{formatDate(selectedLog.createdAt)}</p>
				</div>
				<div class="space-y-1">
					<p class="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total Rows</p>
					<p class="font-medium">{selectedLog.totalRows || 0}</p>
				</div>
				<div class="space-y-1">
					<p class="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Imported</p>
					<p class="font-bold text-green-600">{selectedLog.importedCount || 0}</p>
				</div>
				<div class="space-y-1">
					<p class="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Errors</p>
					<p class="font-bold text-red-600">{selectedLog.errorCount || 0}</p>
				</div>
			</div>

			{#if selectedLog.errors && (selectedLog.errorCount ?? 0) > 0}
				{@const errors = typeof selectedLog.errors === 'string' ? JSON.parse(selectedLog.errors) : selectedLog.errors}
				<div class="mt-6 border-t pt-4">
					<h3 class="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Error Details</h3>
					<div class="max-h-60 overflow-y-auto rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 p-1">
						<div class="space-y-1">
							{#each errors as error (error.row)}
								<div class="rounded border border-zinc-100 dark:border-zinc-850 bg-white dark:bg-zinc-950 p-3 text-xs shadow-sm">
									<div class="flex items-center justify-between mb-1">
										<span class="font-bold text-red-600">Row {error.row}</span>
										<span class="text-muted-foreground text-[10px]">{error.error}</span>
									</div>
									{#if error.details}
										<div class="mt-1 text-muted-foreground italic border-t border-zinc-100 dark:border-zinc-850 pt-1 line-clamp-2" title={error.details}>
											{error.details}
										</div>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				</div>
			{/if}

			<!-- Enhanced Actions -->
			<div class="mt-8 flex flex-col sm:flex-row gap-3 border-t pt-6">
				{#if selectedLog.status === 'success'}
					<Button
						variant="outline"
						class="flex-1 h-11"
						onclick={() => {
							if (selectedLog) {
								close();
								void goto(`/dashboard/preview/${selectedLog.id}`);
							}
						}}
					>
						<Settings2 class="mr-2 h-4 w-4" />
						View Preview / Mapping
					</Button>
					{#if selectedLog.previewLogId}
						<Button
							variant="default"
							class="flex-1 h-11"
							onclick={() => {
								if (selectedLog) {
									window.open(`/debts?import=${selectedLog.previewLogId}`, '_blank');
								}
							}}
						>
							<Eye class="mr-2 h-4 w-4" />
							View Imported Debts
						</Button>
					{/if}
				{:else if selectedLog.status === 'pending' || selectedLog.status === 'queued' || selectedLog.status === 'processing' || selectedLog.status === 'preview'}
					<Button
						variant="default"
						class="w-full h-11"
						onclick={() => {
							if (selectedLog) {
								close();
								void goto(`/dashboard/preview/${selectedLog.id}`);
							}
						}}
					>
						<Settings2 class="mr-2 h-4 w-4" />
						{selectedLog.status === 'preview' ? 'Continue Mapping' : 'Continue / Check Progress'}
					</Button>
				{/if}
			</div>
		{/if}
	</Dialog.Content>
</Dialog.Root>

