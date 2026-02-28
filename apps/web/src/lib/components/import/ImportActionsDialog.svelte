<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { Button } from '@repo/ui/components/ui/button';
	import * as Card from '@repo/ui/components/ui/card';
	import { Badge } from '@repo/ui/components/ui/badge';
	import { cn } from '$lib/utils';
	import IconLucideDownload from '~icons/lucide/download';
	import IconLucideShare from '~icons/lucide/share';
	import IconLucideFileText from '~icons/lucide/file-text';

	interface ImportLog {
		id: string;
		fileName: string;
		status: string;
		totalRows: number;
		importedCount: number;
		errorCount: number;
		createdAt: string;
		previewLogId?: string;
		errors?: string;
	}

	let { log } = $props<{ log: ImportLog }>();

	const dispatch = createEventDispatcher<{
		downloadResults: void;
		shareResults: void;
	}>();

	async function downloadResults() {
		if (!log.previewLogId) return;
		
		try {
			const response = await fetch(`/v1/import/export/${log.previewLogId}`);
			if (response.ok) {
				const blob = await response.blob();
				const url = window.URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = `import-results-${log.fileName.replace(/\.[^/.]+$/, '')}.json`;
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
				window.URL.revokeObjectURL(url);
				
				dispatch('downloadResults');
			}
		} catch (error) {
			console.error('Failed to download results:', error);
		}
	}

	async function shareResults() {
		if (!log.previewLogId) return;
		
		try {
			const response = await fetch(`/v1/import/export/${log.previewLogId}`);
			if (response.ok) {
				const results = await response.json();
				
				if (navigator.share) {
					await navigator.share({
						title: `Import Results: ${log.fileName}`,
						text: `Successfully imported ${log.importedCount} debts from ${log.fileName}`,
						url: window.location.href + `/dashboard/import?log=${log.id}`
					});
					dispatch('shareResults');
				} else {
					// Fallback: Copy to clipboard
					const text = `Import Results: ${log.fileName}\nSuccessfully imported ${log.importedCount} debts\nView details: ${window.location.href}/dashboard/import?log=${log.id}`;
					await navigator.clipboard.writeText(text);
					
					// Show toast notification using console as fallback
					console.log('Results copied to clipboard!');
				}
			}
		} catch (error) {
			console.error('Failed to share results:', error);
		}
	}

	function formatDate(dateStr: string) {
		return new Date(dateStr).toLocaleString();
	}

	function getSuccessRate() {
		if (log.totalRows === 0) return '0%';
		const rate = ((log.importedCount / log.totalRows) * 100).toFixed(1);
		return `${rate}%`;
	}
</script>

<div class="space-y-4">
	<!-- Success Metrics -->
	<Card.Root>
		<Card.Header>
			<Card.Title class="flex items-center gap-2">
				<IconLucideFileText class="h-5 w-5" />
				Import Summary: {log.fileName}
			</Card.Title>
			<Card.Description>
				{formatDate(log.createdAt)}
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
				<div class="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
					<div class="text-3xl font-bold text-green-600">{log.importedCount}</div>
					<div class="text-sm text-muted-foreground">Successfully Imported</div>
				</div>
				
				<div class="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
					<div class="text-3xl font-bold text-blue-600">{log.totalRows - log.importedCount}</div>
					<div class="text-sm text-muted-foreground">Skipped/Errors</div>
				</div>
				
				<div class="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
					<div class="text-3xl font-bold text-orange-600">{getSuccessRate()}</div>
					<div class="text-sm text-muted-foreground">Success Rate</div>
				</div>
			</div>
			
			<!-- Status Badge -->
			<div class="flex justify-center mt-4">
				<Badge 
					variant={log.status === 'success' ? 'default' : 'destructive'}
					class="capitalize text-sm px-3 py-1"
				>
					Status: {log.status}
				</Badge>
			</div>
		</Card.Content>
	</Card.Root>

	<!-- Action Buttons -->
	{#if log.status === 'success' && log.previewLogId}
	<Card.Root>
		<Card.Content>
			<div class="flex flex-col sm:flex-row gap-3">
				<Button 
					on:click={downloadResults}
					class="flex-1"
					variant="outline"
				>
					<IconLucideDownload class="h-4 w-4 mr-2" />
					Download Results
				</Button>
				
				<Button 
					on:click={shareResults}
					class="flex-1"
					variant="outline"
				>
					<IconLucideShare class="h-4 w-4 mr-2" />
					Share Results
				</Button>
			</div>
		</Card.Content>
	</Card.Root>
{/if}
</div>

<style>
	:global(.capitalize) {
		text-transform: capitalize;
	}
</style>
