<script lang="ts">
	import { Settings2, Loader2 } from '@repo/icons';
	import { Button } from '@repo/ui/components/ui/button';
	import { Input } from '@repo/ui/components/ui/input';
	import { Label } from '@repo/ui/components/ui/label';
	import * as Card from '@repo/ui/components/ui/card';
	import * as Table from '@repo/ui/components/ui/table';
	import * as Select from '@repo/ui/components/ui/select';
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
	<Card.Root>
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
				<div class="overflow-hidden rounded-lg border">
					<div class="max-h-[300px] overflow-auto">
						<Table.Root>
							<Table.Header class="sticky top-0 bg-background z-10">
								<Table.Row>
									{#each uploadState.columnHeaders as header}
										<Table.Head class="font-medium whitespace-nowrap">{header}</Table.Head>
									{/each}
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{#each uploadState.previewData.slice(0, 10) as row}
									<Table.Row class="hover:bg-muted/50">
										{#each row as cell}
											<Table.Cell class="px-3 py-2 text-sm max-w-[200px] truncate">
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
						{#each dbFields as field}
							<div class="space-y-2">
								<Label for={field.key} class="text-sm font-medium">
									{field.label}
									{#if field.required}
										<span class="text-red-500">*</span>
									{/if}
								</Label>
								<Select.Root bind:value={columnMapping[field.key]}>
										<Select.Trigger class="w-full" id={field.key}>
											<Select.Value placeholder="-- Select --" />
										</Select.Trigger>
										<Select.Content>
											{#each uploadState.columnHeaders as header}
												<Select.Item value={header} label={header} />
											{/each}
										</Select.Content>
									</Select.Root>
							</div>
						{/each}
					</div>

					{#if missingRequired.length > 0}
						<div class="mt-4 rounded-md border border-yellow-200 bg-yellow-50 p-3">
							<p class="text-sm text-yellow-800">
								<strong>Required fields missing:</strong>
								{missingRequired.join(', ')}
							</p>
						</div>
					{/if}
				</div>

				<!-- IMPORT ACTIONS -->
				<div class="flex items-center justify-between border-t pt-4">
					<div class="flex items-center gap-2 text-sm text-gray-600">
						<span>Starting from row</span>
						<Input
							type="number"
							min="1"
							bind:value={startRow}
							class="w-20 h-9"
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
