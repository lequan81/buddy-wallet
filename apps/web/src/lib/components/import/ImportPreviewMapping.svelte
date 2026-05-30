<script lang="ts">
	import Settings2 from '~icons/lucide/settings-2';
import Loader2 from '~icons/lucide/loader2';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';
	import * as Select from '$lib/components/ui/select';
	import type { UploadState } from '$lib/types';

	let {
		uploadState,
		columnMapping = $bindable(),
		dbFields,
		missingRequired,
		isSubmitting,
		startRow = $bindable(),
		onImport,
		onCancel
	}: {
		uploadState: UploadState;
		columnMapping: Record<string, string>;
		dbFields: Array<{ key: string; label: string; required: boolean }>;
		missingRequired: string[];
		isSubmitting: boolean;
		startRow: number;
		onImport: () => void;
		onCancel: () => void;
	} = $props();
</script>

<div class="space-y-6">
	<Card.Root class="border-0 bg-white dark:bg-zinc-900 shadow-[0_4px_12px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.2)] overflow-hidden rounded-lg">
		<Card.Header>
			<Card.Title class="flex items-center gap-2">
				<Settings2 class="h-5 w-5" /> Preview & Mapping
			</Card.Title>
			<Card.Description>
				{uploadState.totalRows} rows found. Map columns to database fields.
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<div class="space-y-4">
				<!-- Preview Table -->
				<div class="overflow-hidden rounded-lg border border-zinc-100 dark:border-zinc-850 bg-white dark:bg-zinc-950">
					<div class="max-h-75 overflow-auto">
						<Table.Root>
							<Table.Header class="sticky top-0 bg-background z-10">
								<Table.Row>
									{#each uploadState.columnHeaders as header (header)}
										<Table.Head class="font-medium whitespace-nowrap">{header}</Table.Head>
									{/each}
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{#each uploadState.previewData.slice(0, 10) as row, rowIndex (rowIndex)}
									<Table.Row class="hover:bg-muted/50">
										{#each row as cell, cellIndex (cellIndex)}
											<Table.Cell class="px-3 py-2 text-sm max-w-50 truncate">
												{cell}
											</Table.Cell>
										{/each}
									</Table.Row>
								{/each}
							</Table.Body>
						</Table.Root>
					</div>
				</div>

				<!-- Column Mapping -->
				<div>
					<h3 class="mb-4 text-lg font-semibold">Map Columns</h3>
					<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
						{#each dbFields as field (field.key)}
							<div class="space-y-2">
								<Label for={field.key} class="text-sm font-medium">
									{field.label}
									{#if field.required}
										<span class="text-red-500">*</span>
									{/if}
								</Label>
								<Select.Root type="single" bind:value={columnMapping[field.key]}>
										<Select.Trigger class="w-full" id={field.key}>
											<Select.Value placeholder="-- Select --" />
										</Select.Trigger>
										<Select.Content>
											{#each uploadState.columnHeaders as header (header)}
												<Select.Item value={header} label={header} />
											{/each}
										</Select.Content>
									</Select.Root>
							</div>
						{/each}
					</div>

					{#if missingRequired.length > 0}
						<div class="mt-4 rounded-md border border-yellow-100 bg-yellow-50/50 dark:border-yellow-900/30 dark:bg-yellow-950/10 p-3">
							<p class="text-sm text-yellow-800">
								<strong>Required fields missing:</strong>
								{missingRequired.join(', ')}
							</p>
						</div>
					{/if}
				</div>

				<!-- IMPORT ACTIONS -->
				<div class="flex items-center justify-between border-t border-zinc-100 dark:border-zinc-850 pt-4">
					<div class="flex items-center gap-2 text-sm text-gray-600">
						<span>Starting from row</span>
						<input
							type="number"
							min="1"
							bind:value={startRow}
							class="w-20 h-9 rounded-md border border-zinc-100 bg-white focus-visible:ring-0 focus-visible:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:focus-visible:border-zinc-700 transition-colors text-sm px-3 focus:outline-hidden"
						/>
					</div>
					<div class="flex gap-2">
						<Button variant="outline" onclick={onCancel} disabled={isSubmitting}>Cancel</Button>
						<Button
							onclick={onImport}
							disabled={missingRequired.length > 0 || isSubmitting}
						>
							{#if isSubmitting}
								<Loader2 class="mr-2 h-4 w-4 animate-spin" />
							{/if}
							Import Debts
						</Button>
					</div>
				</div>
			</div>
		</Card.Content>
	</Card.Root>
</div>
