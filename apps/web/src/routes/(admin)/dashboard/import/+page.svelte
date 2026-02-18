<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import { Button } from '@repo/ui/components/ui/button';
	import { Input } from '@repo/ui/components/ui/input';
	import { Label } from '@repo/ui/components/ui/label';
	import * as Card from '@repo/ui/components/ui/card';
	import { Progress } from '@repo/ui/components/ui/progress';
	// import {
	// 	ArrowLeft,
	// 	Upload,
	// 	Loader2,
	// 	AlertTriangle,
	// 	CheckCircle,
	// 	Copy,
	// 	XCircle,
	// 	FileSpreadsheet,
	// 	Settings2,
	// 	Send
	import { toast } from 'svelte-sonner';
	import { cn } from '$lib/utils';

	let { form } = $props();
	let isSubmitting = $state(false);
	let isAnalyzing = $state(false);
	let toastId = $state<string | number | undefined>(undefined);
	let lastLogId = $state('');
	let previewLogId = $state('');
	let fileInput = $state<HTMLInputElement>();
	let progress = $state(0);

	// State from preview action
	let previewData = $state<string[][]>([]);
	let columnHeaders = $state<string[]>([]);
	let fileName = $state('');
	let totalRows = $state(0);
	let startRow = $state(2);
	let selectedFiles = $state<FileList>();

	// Column mapping (populated from autoMapping or user selection)
	let columnMapping = $state<Record<string, string>>({
		name: '',
		amount: '',
		phone: '',
		email: '',
		description: '',
		dueDate: ''
	});

	// Database fields
	const dbFields = [
		{ key: 'name', label: 'Name/TÃªn', required: true, description: 'Person who owes' },
		{ key: 'amount', label: 'Amount/Sá»‘ ná»£', required: true, description: 'Debt amount' },
		{ key: 'phone', label: 'Phone', required: false, description: 'For user linking' },
		{ key: 'email', label: 'Email', required: false, description: 'For user linking' },
		{ key: 'description', label: 'Description', required: false, description: 'Notes' },
		{ key: 'dueDate', label: 'Due Date', required: false, description: 'Deadline' }
	];

	const missingRequired = $derived(() => {
		return dbFields.filter((f) => f.required && !columnMapping[f.key]).map((f) => f.label);
	});

	const hasPreview = $derived(() => previewData.length > 0);

	function copyErrorCode(code: string) {
		navigator.clipboard.writeText(code);
		toast.success('Error code copied!');
	}

	function resetForm() {
		previewData = [];
		columnHeaders = [];
		fileName = '';
		totalRows = 0;
		columnMapping = { name: '', amount: '', phone: '', email: '', description: '', dueDate: '' };
		startRow = 2;
		selectedFiles = undefined;
		previewLogId = '';
		progress = 0;
		if (fileInput) fileInput.value = '';
	}

	// Simulate progress during import
	function startProgressSimulation() {
		progress = 0;
		const interval = setInterval(() => {
			if (progress < 90) {
				progress += Math.random() * 15;
			}
		}, 300);
		return () => {
			clearInterval(interval);
			progress = 100;
		};
	}

	// Handle form results
	$effect(() => {
		// Handle preview state updates
		if (form?.preview && form.logId !== lastLogId) {
			fileName = form.fileName || '';
			totalRows = form.totalRows || 0;
			columnHeaders = form.columnHeaders || [];
			previewData = form.previewData || [];
			lastLogId = form.logId;
			previewLogId = form.logId || '';

			// Apply auto-detected mappings (use untrack to prevent infinite loop)
			if (form.autoMapping) {
				const current = untrack(() => columnMapping);
				columnMapping = { ...current, ...form.autoMapping };
			}
			isAnalyzing = false;
		}

		// Handle errors display (fallback if not caught in enhance)
		if (form?.code) {
			isAnalyzing = false;
			isSubmitting = false;
		}
	});

	function handleFileSelect(e: Event & { currentTarget: HTMLInputElement }) {
		if (e.currentTarget.files) {
			selectedFiles = e.currentTarget.files;
		}
	}
</script>

<div class="container max-w-3xl py-10">
	<Button variant="ghost" href="/dashboard" class="mb-6 pl-0 hover:bg-transparent">
		<IconLucideArrowLeft class="mr-2 h-4 w-4" /> Back to Dashboard
	</Button>

	<Card.Root>
		<Card.Header>
			<Card.Title class="flex items-center gap-2">
				<IconLucideFileSpreadsheet class="h-5 w-5" />
				Import Debts from Excel
			</Card.Title>
			<Card.Description>Upload an Excel file and configure column mapping.</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-6">
			<form
				method="POST"
				action="?/preview"
				enctype="multipart/form-data"
				use:enhance={({ action, formData, cancel }) => {
					const isImport = action.search.includes('import');

					if (isImport) {
						if (missingRequired().length > 0) {
							toast.error(`Missing required fields: ${missingRequired().join(', ')}`, {
								duration: 3000
							});
							cancel();
							return;
						}
						if (startRow > totalRows) {
							toast.error(
								`Start Row (${startRow}) cannot be larger than Total Rows (${totalRows})`
							);
							cancel();
							return;
						}
						console.log('[Frontend] Submitting Import...');
						formData.set('config', JSON.stringify({ mapping: columnMapping, startRow }));
						if (previewLogId) {
							formData.set('previewLogId', previewLogId);
						}

						isSubmitting = true;
						toastId = toast.loading('Importing records...', { duration: Infinity });
						const stopProgress = startProgressSimulation();

						return async ({ update, result }) => {
							stopProgress();
							await update({ reset: false });
							isSubmitting = false;

							if (result.type === 'success' && result.data?.success) {
								const d = result.data;
								const count = d.imported;
								const warnings = (d.errors as any[])?.length || 0;
								if (warnings > 0) {
									toast.warning(`Imported ${count} records with ${warnings} warnings`, {
										id: toastId
									});
								} else {
									toast.success(`Successfully imported ${count} records!`, { id: toastId });
								}
								// Reset form manually since we used reset: false
								resetForm();
							} else if (result.type === 'failure') {
								toast.error('Import failed', { id: toastId });
							} else {
								toast.dismiss(toastId);
							}
						};
					} else {
						// Preview Validation
						const fileInput = formData.get('file') as File;
						if (!fileInput || fileInput.size === 0) {
							toast.error('Please select a valid Excel file.');
							cancel();
							return;
						}

						isAnalyzing = true;
						toastId = toast.loading('Analyzing file...', { duration: Infinity });

						return async ({ update, result }) => {
							await update({ reset: false });
							isAnalyzing = false;

							if (result.type === 'success' && result.data?.preview) {
								const d = result.data;
								toast.success(`Loaded ${d.totalRows} rows from "${d.fileName}"`, {
									id: toastId,
									duration: 4000
								});
							} else if (result.type === 'failure') {
								// Failure handled by form prop update usually, but we should clear loading
								toast.error(`Analysis failed`, { id: toastId });
							} else {
								// Redirect or other cases
								toast.dismiss(toastId);
							}
						};
					}
				}}
			>
				<!-- Step 1: File Upload for Preview -->
				<div class:hidden={hasPreview()}>
					<div class="space-y-4">
						<Label class="text-base font-semibold">Select Excel File</Label>
						<div
							class="rounded-lg border-2 border-dashed bg-muted/30 p-8 text-center transition-colors hover:bg-muted/50"
						>
							<Label for="file" class="flex cursor-pointer flex-col items-center">
								{#if selectedFiles && selectedFiles.length > 0}
									<IconLucideFileSpreadsheet class="mb-3 h-10 w-10 text-primary" />
									<span class="font-medium text-primary">{selectedFiles[0].name}</span>
									<span class="mt-1 text-sm text-muted-foreground">Click to change</span>
								{:else}
									<IconLucideUpload class="mb-3 h-10 w-10 text-muted-foreground" />
									<span class="font-medium">Click to select file or drag & drop</span>
									<span class="mt-1 text-sm text-muted-foreground">.xlsx files only</span>
								{/if}
							</Label>
							<Input
								id="file"
								name="file"
								type="file"
								accept=".xlsx"
								class="hidden"
								onchange={handleFileSelect}
								bind:this={fileInput as any}
							/>
						</div>

						<div class="flex justify-end">
							<Button type="submit" formaction="?/preview" disabled={isAnalyzing}>
								{#if isAnalyzing}
									<IconLucideLoader2 class="mr-2 h-4 w-4 animate-spin" /> Analyzing...
								{:else}
									<IconLucideUpload class="mr-2 h-4 w-4" /> Analyze File
								{/if}
							</Button>
						</div>
					</div>
				</div>

				<!-- Step 2: Preview & Mapping -->
				<div class:hidden={!hasPreview()}>
					<!-- File Info -->
					<div
						class="mb-6 flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 p-3"
					>
						<div class="flex items-center gap-3">
							<IconLucideCheckCircle class="h-5 w-5 text-primary" />
							<div>
								<p class="font-medium">{fileName}</p>
								<p class="text-xs text-muted-foreground">
									{totalRows} rows, {columnHeaders.length} columns
								</p>
							</div>
						</div>
						<Button type="button" variant="outline" size="sm" onclick={resetForm}>
							Change File
						</Button>
					</div>

					<!-- Data Preview -->
					<div class="mb-6 space-y-2">
						<Label class="text-sm font-semibold">Preview (First {previewData.length} rows)</Label>
						<div class="max-h-48 overflow-x-auto rounded-lg border">
							<table class="w-full text-xs">
								<thead class="sticky top-0 bg-muted/50">
									<tr>
										<th class="w-8 px-2 py-1.5 text-left font-medium text-muted-foreground">#</th>
										{#each columnHeaders as col}
											<th class="min-w-16 px-2 py-1.5 text-left font-semibold">{col}</th>
										{/each}
									</tr>
								</thead>
								<tbody class="divide-y">
									{#each previewData as row, i}
										<tr class={cn(i === 0 && 'bg-yellow-50 dark:bg-yellow-900/10')}>
											<td class="px-2 py-1 text-muted-foreground">{i + 1}</td>
											{#each row as cell}
												<td class="max-w-24 truncate px-2 py-1">{cell || 'â€”'}</td>
											{/each}
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>

					<!-- Column Mapping -->
					<div class="mb-6 space-y-3">
						<Label class="flex items-center gap-2 text-sm font-semibold">
							<IconLucideSettings2 class="h-4 w-4" />
							Column Mapping
						</Label>

						<div class="grid grid-cols-1 gap-2 md:grid-cols-2">
							{#each dbFields as field}
								<div
									class={cn(
										'flex items-center gap-2 rounded border bg-card p-2',
										field.required &&
											!columnMapping[field.key] &&
											'border-destructive/50 bg-destructive/5'
									)}
								>
									<div class="min-w-0 flex-1">
										<span class="text-sm font-medium">{field.label}</span>
										{#if field.required}
											<span class="text-destructive">*</span>
										{/if}
									</div>
									<select
										bind:value={columnMapping[field.key]}
										class="w-16 rounded border bg-background px-2 py-1 text-sm"
									>
										<option value="">â€”</option>
										{#each columnHeaders as col}
											<option value={col}>{col}</option>
										{/each}
									</select>
								</div>
							{/each}
						</div>
					</div>

					<!-- Start Row -->
					<div class="mb-6 flex items-center gap-3">
						<Label for="startRow" class="text-sm whitespace-nowrap">Data starts at row:</Label>
						<Input type="number" bind:value={startRow} class="h-8 w-16" />
						<span class="text-xs text-muted-foreground">(Skip header rows)</span>
					</div>

					<!-- Missing Fields Warning -->
					{#if missingRequired().length > 0}
						<div
							class="mb-6 flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-destructive"
						>
							<IconLucideAlertTriangle class="mt-0.5 h-4 w-4" />
							<div class="text-sm">
								<p class="font-semibold">Missing required fields</p>
								<p class="text-xs">{missingRequired().join(', ')}</p>
							</div>
						</div>
					{/if}

					<!-- Progress Bar (shown during import) -->
					{#if isSubmitting}
						<div class="mb-6 space-y-2">
							<div class="flex justify-between text-sm">
								<span class="text-muted-foreground">Importing records...</span>
								<span class="font-medium">{Math.round(progress)}%</span>
							</div>
							<Progress value={progress} class="h-2" />
						</div>
					{/if}

					<Button
						type="submit"
						formaction="?/import"
						class="w-full"
						disabled={isSubmitting || missingRequired().length > 0}
					>
						{#if isSubmitting}
							<IconLucideLoader2 class="mr-2 h-4 w-4 animate-spin" /> Importing...
						{:else}
							<IconLucideSend class="mr-2 h-4 w-4" /> Submit file ({totalRows - startRow + 1} records)
						{/if}
					</Button>
				</div>
			</form>

			<!-- Error Display -->
			{#if form?.code && !form?.preview}
				<div
					class="rounded-md border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive"
				>
					<div class="mb-2 flex items-center justify-between">
						<div class="flex items-center gap-2 font-semibold">
							<IconLucideXCircle class="h-4 w-4" />
							Error
						</div>
						<button
							type="button"
							onclick={() => copyErrorCode(form?.code || '')}
							class="flex items-center gap-1 rounded bg-destructive/20 px-2 py-1 text-xs hover:bg-destructive/30"
						>
							<IconLucideCopy class="h-3 w-3" />
							{form.code}
						</button>
					</div>
					<p>{form.message}</p>
				</div>
			{/if}

			<!-- Warnings -->
			{#if form?.errors && form.errors.length > 0}
				<div
					class="rounded-md border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm text-yellow-700 dark:text-yellow-400"
				>
					<div class="mb-2 flex items-center gap-2 font-semibold">
						<IconLucideAlertTriangle class="h-4 w-4" />
						Warnings ({form.errors.length})
					</div>
					<ul class="max-h-32 list-none space-y-1 overflow-y-auto font-mono text-xs">
						{#each form.errors as err, i}
							<li>#{i + 1} {err}</li>
						{/each}
					</ul>
				</div>
			{/if}

			<!-- Success -->
			{#if form?.success}
				<div
					class="rounded-md border border-green-500/20 bg-green-500/10 p-4 text-green-700 dark:text-green-400"
				>
					<div class="flex items-center gap-2 font-semibold">
						<IconLucideCheckCircle class="h-4 w-4" />
						Import Complete â€” {form.imported} records created
					</div>
				</div>
			{/if}
		</Card.Content>
	</Card.Root>
</div>
