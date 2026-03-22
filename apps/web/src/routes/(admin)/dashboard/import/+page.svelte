<script lang="ts">
	import { resolve } from '$app/paths';
	import { ArrowLeft } from '@repo/icons';
	import { onMount, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { enhance } from '$app/forms';
	import { Button } from '@repo/ui/components/ui/button';
	import * as Card from '@repo/ui/components/ui/card';
	import { importProgress } from '$lib/stores/import-progress.svelte';
	import { importUpload } from '$lib/stores/import-upload.svelte';
	import { IMPORT_DB_FIELDS } from '@repo/config/shared';
	import * as m from '$lib/paraglide/messages';
	import type { UploadState } from '$lib/types';
	import type { ImportLog, PreviewResult, ProgressResult } from '@repo/types';

	// Components
	import ImportSkeleton from '$lib/components/import/ImportSkeleton.svelte';
	import ImportUploadZone from '$lib/components/import/ImportUploadZone.svelte';
	import ImportPreviewMapping from '$lib/components/import/ImportPreviewMapping.svelte';
	import ImportHistoryTable from '$lib/components/import/ImportHistoryTable.svelte';
	import ImportLogDetailsDialog from '$lib/components/import/ImportLogDetailsDialog.svelte';

	let { data } = $props();

	// === GROUPED STATE ===
	let ui = $state({
		showDetails: false,
		showConnectionFallback: false,
		connectionError: '',
		isSubmitting: false,
		loadingHistory: false,
		isInitialLoading: true,
		jumpPage: ''
	});

	let importForm = $state({
		currentJobId: '',
		startRow: 2,
		columnMapping: {
			name: '',
			amount: '',
			phone: '',
			email: '',
			description: '',
			dueDate: ''
		} as Record<string, string>
	});

	let uploadState = $state<UploadState>({
		file: null,
		uploadId: null,
		previewData: [],
		columnHeaders: [],
		fileName: '',
		totalRows: 0,
		status: 'idle',
		error: null,
		uploadProgress: 0
	});

	let historyPage = $state(1);
	let selectedLog = $state<ImportLog | null>(null);

	// Form References
	let uploadForm = $state<HTMLFormElement>();
	let importActionForm = $state<HTMLFormElement>();
	let hiddenFileInput = $state<HTMLInputElement>();

	// === DERIVED ===
	const fieldLabels: Record<string, () => string> = {
		name: m.import_field_name,
		amount: m.import_field_amount,
		phone: m.import_field_phone,
		email: m.import_field_email,
		description: m.import_field_description,
		dueDate: m.import_field_dueDate
	};

	const dbFields = $derived(
		IMPORT_DB_FIELDS.map((f) => ({
			...f,
			label: fieldLabels[f.key]?.() ?? f.key
		}))
	);

	const missingRequired = $derived(
		dbFields.filter((f) => f.required && !importForm.columnMapping[f.key]).map((f) => f.label)
	);

	const hasPreview = $derived(uploadState.previewData.length > 0);
	const currentJob = $derived(importProgress.getJob(importForm.currentJobId));
	const logs = $derived((data.logs as ImportLog[]) || []);
	const totalHistoryPages = $derived(Math.max(1, data.historyTotalPages || 1));

	// === ACTIONS ===
	const resetUploadState = () => {
		uploadState = {
			file: null,
			uploadId: null,
			previewData: [],
			columnHeaders: [],
			fileName: '',
			totalRows: 0,
			status: 'idle',
			error: null,
			uploadProgress: 0
		};
		importForm.currentJobId = '';
		importUpload.reset();
		if (hiddenFileInput) hiddenFileInput.value = '';
	};

	const fetchLogs = async (pageNumber = historyPage) => {
		ui.loadingHistory = true;
		ui.connectionError = '';
		ui.showConnectionFallback = false;

		try {
			// SvelteKit idiomatic way to refresh data without full page reload is invalidateAll 
			// combined with URLSearchParams. 
			// The user wants to reduce use of path params, but for search/pagination 
			// it's the standard SvelteKit way. We'll at least hide it from the user 
			// where possible or keep it clean.
			await goto(`?historyPage=${pageNumber}`, { 
				replaceState: true, 
				noScroll: true, 
				keepFocus: true, 
				invalidateAll: true 
			});
			historyPage = pageNumber;
		} catch (err) {
			ui.connectionError = err instanceof Error ? err.message : 'Failed to load import history.';
			ui.showConnectionFallback = true;
		} finally {
			ui.loadingHistory = false;
		}
	};

	// === LIFECYCLE ===
	onMount(() => {
		setTimeout(() => { ui.isInitialLoading = false; }, 400);

		if (importUpload.state.status !== 'idle') {
			uploadState = { ...importUpload.state };
			importForm.columnMapping = { ...importUpload.columnMapping };
			importForm.startRow = importUpload.startRow;
		}

		const threeHoursAgo = Date.now() - 3 * 60 * 60 * 1000;
		for (const log of logs) {
			if (log.status === 'processing' || log.status === 'pending') {
				const logTime = new Date(log.createdAt).getTime();
				if (logTime > threeHoursAgo) {
					if (!importProgress.getJob(log.id)) {
						importProgress.addJob(log.id, 'import', log.fileName);
					}
				}
			}
		}
	});

	// Sync state to importUpload store
	$effect(() => {
		if (uploadState.status !== 'idle') {
			importUpload.state = { ...uploadState };
			importUpload.columnMapping = { ...importForm.columnMapping };
			importUpload.startRow = importForm.startRow;
		}
	});

	$effect(() => {
		if (currentJob?.status === 'success' && currentJob.result) {
			const res = currentJob.result as ProgressResult;
			if (currentJob.type === 'preview') {
				const previewRes = res as unknown as PreviewResult; 
				uploadState.status = 'preview-ready';
				uploadState.fileName = previewRes.fileName || uploadState.fileName;
				uploadState.totalRows = previewRes.totalRows || 0;
				uploadState.columnHeaders = previewRes.columnHeaders || [];
				uploadState.previewData = previewRes.previewData || [];

				if (previewRes.autoMapping) {
					const current = untrack(() => importForm.columnMapping);
					importForm.columnMapping = { ...current, ...previewRes.autoMapping };
				}
			} else if (currentJob.type === 'import') {
				ui.isSubmitting = false;
				void fetchLogs(1);
				resetUploadState();
				toast.success('Import completed successfully!');
			}
		} else if (currentJob?.status === 'failed') {
			uploadState.status = 'error';
			uploadState.error = currentJob.error || 'Operation failed';
			ui.isSubmitting = false;
			toast.error(currentJob.error || 'Operation failed');
		}
	});
</script>

<div class="container max-w-6xl space-y-6 py-10">
	<!-- Page Header -->
	<div class="mb-4 flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold tracking-tight">Import Debts</h1>
			<p class="text-muted-foreground italic">Bulk import debts from spreadsheet files</p>
		</div>
		<Button href={resolve(`/dashboard`, {})} variant="ghost" class="h-9 transition-colors hover:bg-muted">
			<ArrowLeft class="mr-2 h-4 w-4" />
			Back to Dashboard
		</Button>
	</div>

	{#if ui.isInitialLoading}
		<ImportSkeleton />
	{:else}
		<div class="grid grid-cols-1 items-start gap-8 lg:grid-cols-[1.3fr_1fr]">
			<!-- Left Side: Import Form -->
			<div class="space-y-6">
				<Card.Root class="overflow-hidden">
					<Card.Header class="bg-muted/30">
						<Card.Title class="text-lg">Step 1: Upload File</Card.Title>
						<Card.Description>Select an Excel or CSV file to begin parsing headers.</Card.Description>
					</Card.Header>
					<Card.Content class="pt-6">
						<form
							bind:this={uploadForm}
							method="POST"
							action="?/preview"
							enctype="multipart/form-data"
							use:enhance={() => {
								uploadState.status = 'uploading';
								return async ({ result }) => {
									if (result.type === 'success') {
										const actionData = result.data as { success?: boolean; jobId?: string; message?: string; previewData?: string[][]; totalRows?: number; columnHeaders?: string[]; autoMapping?: Record<string, string> };
										if (actionData?.success && actionData?.jobId) {
											importForm.currentJobId = actionData.jobId;
											importProgress.addJob(importForm.currentJobId, 'preview', uploadState.fileName, uploadState.file || undefined);
											uploadState.status = 'preview-loading';
											toast.success('File uploaded! Waiting for preview...');
											
											if (actionData.previewData) {
												uploadState.status = 'preview-ready';
												uploadState.totalRows = actionData.totalRows || 0;
												uploadState.columnHeaders = actionData.columnHeaders || [];
												uploadState.previewData = actionData.previewData || [];
												if (actionData.autoMapping) {
													importForm.columnMapping = { ...importForm.columnMapping, ...actionData.autoMapping };
												}
											}
										} else {
											uploadState.status = 'error';
											uploadState.error = actionData?.message || 'Upload failed';
										}
									} else {
										uploadState.status = 'error';
										uploadState.error = 'Server error during upload';
										toast.error('Upload failed. Please check file format.');
									}
								};
							}}
						>
							<input 
								bind:this={hiddenFileInput}
								type="file" 
								name="file" 
								class="hidden" 
								accept=".xlsx,.xls,.csv"
								onchange={() => uploadForm?.requestSubmit()}
							/>
							<ImportUploadZone
								bind:uploadState
								onUpload={(file) => {
									const dataTransfer = new DataTransfer();
									dataTransfer.items.add(file);
									if (hiddenFileInput) hiddenFileInput.files = dataTransfer.files;
									uploadState.fileName = file.name;
									uploadForm?.requestSubmit();
								}}
								onReset={resetUploadState}
							/>
						</form>
					</Card.Content>
				</Card.Root>

				{#if uploadState.status === 'preview-ready' && hasPreview}
					<form
						bind:this={importActionForm}
						method="POST"
						action="?/import"
						enctype="multipart/form-data"
						use:enhance={() => {
							ui.isSubmitting = true;
							return async ({ result }) => {
								if (result.type === 'success') {
									const actionData = result.data as { success?: boolean; jobId?: string; message?: string };
									if (actionData?.success && actionData?.jobId) {
										toast.success(`Import job #${actionData.jobId} started!`);
										importForm.currentJobId = actionData.jobId;
										importProgress.addJob(importForm.currentJobId, 'import', uploadState.fileName, uploadState.file || undefined);
										resetUploadState();
										void fetchLogs(1);
									} else {
										toast.error(actionData?.message || 'Import failed');
									}
								} else {
									toast.error('Server error during import submission');
								}
								ui.isSubmitting = false;
							};
						}}
					>
						<!-- Pass file again for the actual import action if needed by server -->
						<input type="hidden" name="file" value={uploadState.file} />
						<input type="hidden" name="config" value={JSON.stringify({
							mapping: importForm.columnMapping,
							startRow: importForm.startRow
						})} />
						<input type="hidden" name="previewLogId" value={importForm.currentJobId} />
						
						<ImportPreviewMapping
							{uploadState}
							bind:columnMapping={importForm.columnMapping}
							{dbFields}
							{missingRequired}
							isSubmitting={ui.isSubmitting}
							bind:startRow={importForm.startRow}
							onImport={() => importActionForm?.requestSubmit()} 
							onCancel={resetUploadState}
						/>
					</form>
				{/if}
			</div>

			<!-- Right Side: History -->
			<div class="space-y-6">
				<Card.Root class="sticky top-6 overflow-hidden">
					<Card.Header class="bg-muted/30 border-b pb-3">
						<Card.Title class="text-base flex items-center gap-2">
							Recent Imports
						</Card.Title>
					</Card.Header>
					<Card.Content class="p-0">
						<ImportHistoryTable
							{logs}
							loadingHistory={ui.loadingHistory}
							{historyPage}
							{totalHistoryPages}
							connectionError={ui.connectionError}
							showConnectionFallback={ui.showConnectionFallback}
							{importProgress}
							onFetchLogs={fetchLogs}
							onViewDetails={(log: ImportLog) => {
								selectedLog = log;
								ui.showDetails = true;
							}}
						/>
					</Card.Content>
				</Card.Root>
			</div>
		</div>
	{/if}
</div>

<ImportLogDetailsDialog
	bind:selectedLog
	bind:showDetails={ui.showDetails}
/>
