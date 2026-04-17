<script lang="ts">
	import { resolve } from '$app/paths';
	import { ArrowLeft } from '@repo/icons';
	import { onMount, untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { enhance } from '$app/forms';
	import { Button } from '@repo/ui/components/ui/button';
	import * as Card from '@repo/ui/components/ui/card';
	import { api } from '$lib/services/api';
	import { importProgress } from '$lib/stores/import-progress.svelte';
	import { importUpload } from '$lib/stores/import-upload.svelte';
	import { transitionImportUploadState } from '$lib/state-machines/import-upload.machine';
	import { IMPORT_DB_FIELDS } from '@repo/config/shared';
	import * as m from '$lib/paraglide/messages';
	import type { UploadState } from '$lib/types';
	import type { ImportLog, PreviewResult } from '@repo/types/core/import';

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

	let historyLogs = $state<ImportLog[]>([]);
	let historyTotalPages = $state(1);

	$effect(() => {
		historyLogs = (data.logs as ImportLog[]) || [];
		historyTotalPages = Math.max(1, data.historyTotalPages || 1);
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
	const logs = $derived(historyLogs);
	const totalHistoryPages = $derived(historyTotalPages);

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

	const setUploadStatus = (nextStatus: UploadState['status']) => {
		const transition = transitionImportUploadState(uploadState.status, nextStatus);
		if (!transition.allowed) {
			console.warn('[Import][UploadFSM]', transition.reason);
			return;
		}

		uploadState.status = transition.to;
	};

	const fetchLogs = async (pageNumber = historyPage, options: { silent?: boolean } = {}) => {
		if (!options.silent) {
			ui.loadingHistory = true;
		}
		ui.connectionError = '';
		ui.showConnectionFallback = false;

		try {
			const { data: response, error } = await (api.v1.import.logs as any).index.get({
				query: {
					page: String(pageNumber),
					limit: '10'
				}
			});

			if (error || !response) {
				throw new Error((error?.value as { message?: string })?.message || 'Failed to load import history.');
			}

			// response is PaginatedResult<ImportLog>
			const res = response as unknown as { items: ImportLog[]; pagination: { total: number; limit: number } };
			historyLogs = res.items ?? [];
			if (res.pagination) {
				historyTotalPages = Math.ceil(res.pagination.total / res.pagination.limit) || 1;
			}
			historyPage = Math.max(1, Math.min(pageNumber, historyTotalPages));
		} catch (err) {
			ui.connectionError = err instanceof Error ? err.message : 'Failed to load import history.';
			ui.showConnectionFallback = true;
		} finally {
			if (!options.silent) {
				ui.loadingHistory = false;
			}
		}
	};

	// === LIFECYCLE ===
	onMount(() => {
		setTimeout(() => { ui.isInitialLoading = false; }, 400);
		historyPage = Math.max(1, Number(data.historyPage || 1));

		if (importUpload.state.status !== 'idle') {
			uploadState = { ...importUpload.state };
			importForm.columnMapping = { ...importUpload.columnMapping };
			importForm.startRow = importUpload.startRow;
		}

		const threeHoursAgo = Date.now() - 3 * 60 * 60 * 1000;
		for (const log of logs) {
			const status = log.status as string;
			if (status === 'processing' || status === 'pending' || status === 'queued') {
				const logTime = new Date(log.createdAt).getTime();
				if (logTime > threeHoursAgo) {
					if (!importProgress.getJob(log.id)) {
						importProgress.addJob(log.id, 'import', log.fileName, data.user?.id || 'unknown');
					}
				}
			}
		}

		const interval = setInterval(() => {
			const hasActiveJobs = Array.from(importProgress.activeJobs.values()).some((job) => {
				const s = job.status as string;
				return s === 'pending' || s === 'queued' || s === 'processing';
			});
			if (hasActiveJobs) {
				void fetchLogs(historyPage, { silent: true });
			}
		}, 3000);

		return () => clearInterval(interval);
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
			const res = currentJob.result;
			if (currentJob.type === 'preview') {
				const previewRes = 'data' in res ? res.data : res; 
				setUploadStatus('preview-ready');
				uploadState.fileName = (previewRes as any).fileName || uploadState.fileName;
				uploadState.totalRows = (previewRes as any).totalRows || 0;
				uploadState.columnHeaders = (previewRes as any).columnHeaders || [];
				uploadState.previewData = (previewRes as any).previewData || [];

				if ((previewRes as any).autoMapping) {
					const current = untrack(() => importForm.columnMapping);
					importForm.columnMapping = { ...current, ...(previewRes as any).autoMapping };
				}
				void fetchLogs(1);
			} else if (currentJob.type === 'import') {
				ui.isSubmitting = false;
				void fetchLogs(1);
				resetUploadState();
				toast.success('Import completed successfully!');
			}
		} else if (currentJob?.status === 'failed') {
			setUploadStatus('error');
			uploadState.error = currentJob.error || 'Operation failed';
			ui.isSubmitting = false;
			toast.error(currentJob.error || 'Operation failed');
			void fetchLogs(1);
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
								setUploadStatus('uploading');
								return async ({ result }) => {
									if (result.type === 'success') {
										const actionData = result.data as { success?: boolean; jobId?: string; message?: string; previewData?: string[][]; totalRows?: number; columnHeaders?: string[]; autoMapping?: Record<string, string> };
										if (actionData?.success && actionData?.jobId) {
											importForm.currentJobId = actionData.jobId;
											importProgress.addJob(importForm.currentJobId, 'preview', uploadState.fileName, data.user?.id || 'unknown', uploadState.file || undefined);
											setUploadStatus('preview-loading');
											toast.success('File uploaded! Waiting for preview...');
											
											if (actionData.previewData) {
												setUploadStatus('preview-ready');
												uploadState.totalRows = actionData.totalRows || 0;
												uploadState.columnHeaders = actionData.columnHeaders || [];
												uploadState.previewData = actionData.previewData || [];
												if (actionData.autoMapping) {
													importForm.columnMapping = { ...importForm.columnMapping, ...actionData.autoMapping };
												}
											}
										} else {
											setUploadStatus('error');
											uploadState.error = actionData?.message || 'Upload failed';
										}
									} else {
										setUploadStatus('error');
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
						use:enhance={({ formData }) => {
							if (uploadState.file) {
								formData.set('file', uploadState.file);
							}
							ui.isSubmitting = true;
							return async ({ result }) => {
								if (result.type === 'success') {
									const actionData = result.data as { success?: boolean; jobId?: string; message?: string };
									if (actionData?.success && actionData?.jobId) {
										toast.success(`Import job #${actionData.jobId} started!`);
										importForm.currentJobId = actionData.jobId;
										importProgress.addJob(importForm.currentJobId, 'import', uploadState.fileName, data.user?.id || 'unknown', uploadState.file || undefined);
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
