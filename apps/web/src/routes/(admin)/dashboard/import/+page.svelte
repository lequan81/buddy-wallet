<script lang="ts">
	// @ts-nocheck
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { slide, fade } from 'svelte/transition';
	import { Button } from '@repo/ui/components/ui/button';
	import { Input } from '@repo/ui/components/ui/input';
	import { Label } from '@repo/ui/components/ui/label';
	import * as Card from '@repo/ui/components/ui/card';
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
	import { importProgress } from '$lib/stores/import-progress.svelte';

	let { form } = $props();
	let isSubmitting = $state(false);
	let isAnalyzing = $state(false);
	let lastLogId = $state('');
	let previewLogId = $state('');
	let fileInput = $state<HTMLInputElement>();

	// State from preview action
	let previewData = $state<string[][]>([]);
	let columnHeaders = $state<string[]>([]);
	let fileName = $state('');
	let totalRows = $state(0);
	let startRow = $state(2);
	let selectedFiles = $state<FileList>();
	let storedFile: File | null = null;

	// Track current job
	let currentJobId = $state('');
	let currentJob = $derived(importProgress.getJob(currentJobId));

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
		{ key: 'name', label: 'Name/Tên', required: true, description: 'Person who owes' },
		{ key: 'amount', label: 'Amount/Số nợ', required: true, description: 'Debt amount' },
		{ key: 'phone', label: 'Phone', required: true, description: 'For user linking' },
		{ key: 'email', label: 'Email', required: false, description: 'For user linking' },
		{ key: 'description', label: 'Description', required: false, description: 'Notes' },
		{ key: 'dueDate', label: 'Due Date', required: false, description: 'Deadline' }
	];

	// Derived state
	let missingRequired = $derived(
		dbFields.filter((f) => f.required && !columnMapping[f.key]).map((f) => f.label)
	);

	let hasPreview = $derived(previewData.length > 0);

	// Restore state from global store if available
	$effect(() => {
		// Find most recent relevant job
		// We track 'currentJobId' locally, but if it's empty (reload/nav), check store
		if (!currentJobId) {
			const jobs = Array.from(importProgress.activeJobs.values());
			// Find last preview job that is successful
			const recentPreview = jobs
				.reverse()
				.find((j) => j.type === 'preview' && j.status === 'success' && j.result);

			if (recentPreview && recentPreview.result) {
				// Restore it!
				currentJobId = recentPreview.jobId;
				// The main effect will pick up 'currentJob' change and hydrate the UI
			}
		}
	});

	// React to job completion
	$effect(() => {
		if (currentJob?.status === 'success' && currentJob.result) {
			const res = currentJob.result;

			if (currentJob.type === 'preview') {
				isAnalyzing = false;
				fileName = res.fileName || fileName;
				totalRows = res.totalRows || 0;
				columnHeaders = res.columnHeaders || [];
				previewData = res.previewData || [];
				lastLogId = res.logId;
				previewLogId = res.logId || '';

				if (res.autoMapping) {
					const current = untrack(() => columnMapping);
					columnMapping = { ...current, ...res.autoMapping };
				}

				// Do NOT remove job - let it stay in global toast for feedback
			} else if (currentJob.type === 'import') {
				isSubmitting = false;
				const count = res.imported;
				const errors = res.errors?.length || 0;

				if (errors > 0) {
					toast.warning(`Imported ${count} records with ${errors} warnings`);
				} else {
					toast.success(`Successfully imported ${count} records!`);
				}

				resetForm();
			}
		} else if (currentJob?.status === 'failed') {
			isAnalyzing = false;
			isSubmitting = false;
			toast.error(currentJob.error || 'Operation failed');
			// Do NOT remove job - let user see error
		}
	});

	function handleFileSelect(e: Event & { currentTarget: HTMLInputElement }) {
		if (e.currentTarget.files && e.currentTarget.files.length > 0) {
			selectedFiles = e.currentTarget.files;
			storedFile = e.currentTarget.files[0];
			fileName = storedFile.name; // Set immediately for UI feedback
			// Auto-submit for preview
			e.currentTarget.form?.requestSubmit();
		}
	}

	function resetForm() {
		fileName = '';
		totalRows = 0;
		columnHeaders = [];
		previewData = [];
		lastLogId = '';
		previewLogId = '';
		selectedFiles = undefined;
		storedFile = null;
		columnMapping = {
			name: '',
			amount: '',
			phone: '',
			email: '',
			description: '',
			dueDate: ''
		};
		if (fileInput) fileInput.value = '';
		currentJobId = '';
	}

	function copyErrorCode(code: string) {
		navigator.clipboard.writeText(code);
		toast.success('Error code copied to clipboard');
	}
</script>

<div class="container max-w-3xl py-10">
	<Button variant="ghost" href="/dashboard" class="mb-6 pl-0 hover:bg-transparent">
		<IconLucideArrowLeft class="mr-2 h-4 w-4" /> Back to Dashboard
	</Button>

	<Card.Root>
		<Card.Header>
			<div class="flex items-center justify-between">
				<div class="space-y-1">
					<Card.Title class="flex items-center gap-2">
						<IconLucideFileSpreadsheet class="h-5 w-5" />
						Import Debts from Excel
					</Card.Title>
					<Card.Description>Upload an Excel file and configure column mapping.</Card.Description>
				</div>
				<Button variant="outline" size="sm" href="/dashboard/import/tasks">
					<IconLucideClock class="mr-2 h-4 w-4" /> History
				</Button>
			</div>
		</Card.Header>
		<Card.Content class="space-y-6">
			<form
				method="POST"
				action="?/preview"
				enctype="multipart/form-data"
				use:enhance={({ action, formData, cancel }) => {
					const isImport = action.search.includes('import');

					if (isImport) {
						if (missingRequired.length > 0) {
							toast.error(`Missing required fields: ${missingRequired.join(', ')}`);
							cancel();
							return;
						}
						isSubmitting = true;

						return async ({ result }) => {
							if (result.type === 'success' && result.data?.success) {
								const d = result.data as any;
								currentJobId = d.jobId;
								importProgress.addJob(d.jobId, 'import', fileName);
								toast.info('Import started in background');
							} else {
								isSubmitting = false;
								toast.error(result.data?.message || 'Failed to start import');
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
						// toastId = toast.loading('Uploading file...');

						return async ({ result }) => {
							if (result.type === 'success' && result.data?.success) {
								const d = result.data as any;
								currentJobId = d.jobId;
								importProgress.addJob(d.jobId, 'preview', fileInput.name);
								// Global toast will show progress
							} else {
								isAnalyzing = false;
								toast.error(result.data?.message || 'Failed to start analysis');
							}
						};
					}
				}}
			>
				<!-- Step 1: File Upload for Preview -->
				{#if !hasPreview}
					<div class="space-y-4" transition:slide={{ duration: 300 }}>
						<Label class="text-base font-semibold">Select Excel File</Label>
						<div
							class="rounded-lg border-2 border-dashed bg-muted/30 p-8 text-center transition-colors hover:bg-muted/50"
						>
							<Label for="file" class="flex cursor-pointer flex-col items-center">
								{#if isAnalyzing}
									<IconLucideLoader2 class="mb-3 h-10 w-10 animate-spin text-primary" />
									<span class="font-medium text-primary">Analyzing file...</span>
								{:else if selectedFiles && selectedFiles.length > 0}
									<IconLucideFileSpreadsheet class="mb-3 h-10 w-10 text-primary" />
									<span class="font-medium text-primary">{selectedFiles[0].name}</span>
									<span class="mt-1 text-sm text-muted-foreground">Click to change</span>
								{:else}
									<IconLucideUpload class="mb-3 h-10 w-10 text-muted-foreground" />
									<span class="font-medium">Click to select file</span>
									<span class="mt-1 text-sm text-muted-foreground">.xlsx files only</span>
								{/if}
							</Label>
						</div>
						<!-- Removed manual Analyze button -->
					</div>
				{/if}

				<!-- Hidden File Input (Must be always present for form submission) -->
				<Input
					id="file"
					name="file"
					type="file"
					accept=".xlsx"
					class="hidden"
					onchange={handleFileSelect}
					bind:this={fileInput as any}
				/>

				<!-- Step 2: Preview & Mapping -->
				{#if hasPreview}
					<div transition:slide={{ duration: 300 }}>
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
													<td class="max-w-24 truncate px-2 py-1">{cell || '—'}</td>
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
											<option value="">—</option>
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
						{#if missingRequired.length > 0}
							<div
								class="mb-6 flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-destructive"
								transition:slide
							>
								<IconLucideAlertTriangle class="mt-0.5 h-4 w-4" />
								<div class="text-sm">
									<p class="font-semibold">Missing required fields</p>
									<p class="text-xs">{missingRequired.join(', ')}</p>
								</div>
							</div>
						{/if}

						<Button
							type="submit"
							formaction="?/import"
							class="w-full"
							disabled={isSubmitting || missingRequired.length > 0}
						>
							{#if isSubmitting}
								<IconLucideLoader2 class="mr-2 h-4 w-4 animate-spin" /> Importing...
							{:else}
								<IconLucideSend class="mr-2 h-4 w-4" /> Submit file ({totalRows - startRow + 1} records)
							{/if}
						</Button>
					</div>
				{/if}
			</form>

			<!-- Error Display -->
			{#if form?.code && !form?.preview}
				<div
					class="rounded-md border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive"
					transition:fade
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
					transition:fade
				>
					<div class="flex items-center gap-2 font-semibold">
						<IconLucideCheckCircle class="h-4 w-4" />
						Import Complete — {form.imported} records created
					</div>
				</div>
			{/if}
		</Card.Content>
	</Card.Root>
</div>
