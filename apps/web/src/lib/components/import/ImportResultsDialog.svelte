<script lang="ts">
	import ExternalLink from '~icons/lucide/external-link';
import FileSpreadsheet from '~icons/lucide/file-spreadsheet';
	import { createEventDispatcher } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { formatDate } from '@repo/utils/format';
	import type { ImportLog, ImportDetailResult } from '@repo/types/shared/import';
	import { getImportResults } from '$lib/remotes/import.remote';

	let { log } = $props<{ log: ImportLog }>();
	let showResults = $state(false);
	let loadingResults = $state(false);
	let results: ImportDetailResult | null = $state(null);

	const dispatch = createEventDispatcher<{
		viewDebt: void;
	}>();

	async function loadImportResults() {
		if (!log.previewLogId && log.status !== 'success') return;
		
		loadingResults = true;
		try {
			const data = await getImportResults(log.previewLogId);
			if (data) {
				results = data as unknown as ImportDetailResult;
				showResults = true;
			}
		} catch (error) {
			console.error('Failed to load import results:', error);
		} finally {
			loadingResults = false;
		}
	}

	function handleViewDebt(_debtId: string) {
		dispatch('viewDebt');
	}

</script>

<div class="space-y-4">
	<!-- Import Summary -->
	<Card.Root>
		<Card.Header>
			<Card.Title class="flex items-center gap-2">
				<FileSpreadsheet class="h-5 w-5" />
				Import Results: {log.fileName}
			</Card.Title>
			<Card.Description>
				{formatDate(log.createdAt)}
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
				<div class="text-center">
					<div class="text-2xl font-bold text-green-600">{log.importedCount}</div>
					<div class="text-sm text-muted-foreground">Imported</div>
				</div>
				<div class="text-center">
					<div class="text-2xl font-bold text-blue-600">{log.totalRows - log.importedCount}</div>
					<div class="text-sm text-muted-foreground">Skipped</div>
				</div>
				<div class="text-center">
					<div class="text-2xl font-bold text-orange-600">{log.errorCount}</div>
					<div class="text-sm text-muted-foreground">Errors</div>
				</div>
			</div>
			
			<!-- Status Badge -->
			<div class="flex justify-center">
				<Badge 
					variant={log.status === 'success' ? 'default' : 'destructive'}
					class="capitalize"
				>
					{log.status}
				</Badge>
			</div>
		</Card.Content>
	</Card.Root>

	<!-- Load Results Button -->
	{#if log.previewLogId && log.status === 'success' && !showResults}
		<Button 
			onclick={loadImportResults}
			disabled={loadingResults}
			class="w-full"
		>
			{#if loadingResults}
				Loading Results...
			{:else}
				View Imported Debts ({log.importedCount})
			{/if}
		</Button>
	{/if}

	<!-- Results Display -->
	{#if showResults && results}
		<Card.Root>
		<Card.Header>
			<Card.Title>Successfully Imported Debts</Card.Title>
			<Card.Description>
				{results.importedDebts.length} debts were imported successfully
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<div class="space-y-4">
				{#each results.importedDebts as debt}
					<div class="flex items-center justify-between p-4 border rounded-lg">
						<div class="flex-1">
							<div class="font-medium">{debt.description}</div>
							<div class="text-sm text-muted-foreground">
								{#if debt.debtorName}
									Owed by: {debt.debtorName}
								{:else}
									No debtor assigned
								{/if}
							</div>
						</div>
						<div class="text-right">
							<div class="text-lg font-bold">
								{new Intl.NumberFormat('vi-VN', {
									style: 'currency',
									currency: 'VND'
								}).format(debt.amount)}
							</div>
							<Button
								size="sm"
								variant="outline"
								onclick={() => handleViewDebt(debt.id)}
							>
								<ExternalLink class="h-3 w-3 mr-1" />
								View
							</Button>
						</div>
					</div>
				{/each}

				{#if results.skippedRows.length > 0}
					<div class="mt-6">
						<h3 class="text-lg font-semibold mb-3">Skipped Rows</h3>
						<div class="space-y-2">
							{#each results.skippedRows as skip}
								<div class="flex items-center justify-between p-3 bg-muted/50 rounded">
									<span class="text-sm">Row {skip.rowNumber}</span>
									<span class="text-sm text-muted-foreground">{skip.reason}</span>
								</div>
							{/each}
						</div>
					</div>
				{/if}
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

