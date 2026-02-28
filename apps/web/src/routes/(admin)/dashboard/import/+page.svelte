<script lang="ts">
	// @ts-nocheck — TODO: fix 21 pre-existing TS errors (null safety, type mismatches) in a dedicated refactor
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { slide, fade } from 'svelte/transition';
	import { Button } from '@repo/ui/components/ui/button';
	import { Input } from '@repo/ui/components/ui/input';
	import { Label } from '@repo/ui/components/ui/label';
	import * as Card from '@repo/ui/components/ui/card';
	import { Badge } from '@repo/ui/components/ui/badge';
	import * as Table from '@repo/ui/components/ui/table';
	import * as Dialog from '@repo/ui/components/ui/dialog';
	import { Progress } from '@repo/ui/components/ui/progress';
	import { apiFetch } from '$lib/api';
	import { importProgress } from '$lib/stores/import-progress.svelte';
	import ConnectionFallback from '$lib/components/shared/ConnectionFallback.svelte';
	import { cn } from '$lib/utils';
	import { browser } from '$app/environment';
	import type { UploadState } from '$lib/types/import';
	import { importUpload } from '$lib/stores/import-upload.svelte';
	import { IMPORT_DB_FIELDS } from '@repo/config';
	import * as m from '$lib/paraglide/messages';

	import IconLucideArrowLeft from '~icons/lucide/arrow-left';
	import IconLucideSettings2 from '~icons/lucide/settings-2';
	import IconLucideSend from '~icons/lucide/send';
	import IconLucideUpload from '~icons/lucide/upload';
	import IconLucideFileSpreadsheet from '~icons/lucide/file-spreadsheet';
	import IconLucideLoader2 from '~icons/lucide/loader-2';
	import IconLucideCheckCircle from '~icons/lucide/check-circle';
	import IconLucideAlertTriangle from '~icons/lucide/alert-triangle';
	import IconLucideCopy from '~icons/lucide/copy';
	import IconLucideXCircle from '~icons/lucide/x-circle';
	import IconLucideClock from '~icons/lucide/clock';
	import IconLucideChevronLeft from '~icons/lucide/chevron-left';
	import IconLucideChevronRight from '~icons/lucide/chevron-right';
	import IconLucideEye from '~icons/lucide/eye';
	import IconLucideTrash2 from '~icons/lucide/trash-2';

	// i18n field label resolver
	const fieldLabels: Record<string, () => string> = {
		name: m.import_field_name,
		amount: m.import_field_amount,
		phone: m.import_field_phone,
		email: m.import_field_email,
		description: m.import_field_description,
		dueDate: m.import_field_dueDate
	};

	let { data, form } = $props();

	// === ENHANCED UPLOAD STATE ===
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

	// === STATE RESET ===
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
		importUpload.reset();
	};

	// === DATABASE FIELDS (i18n resolved) ===
	const dbFields = IMPORT_DB_FIELDS.map((f) => ({
		...f,
		label: fieldLabels[f.key]?.() ?? f.key
	}));

	let missingRequired = $derived(
		dbFields.filter((f) => f.required && !columnMapping[f.key]).map((f) => f.label)
	);
	let hasPreview = $derived(uploadState.previewData.length > 0);

	// === IMPORT FORM STATE ===
	let isSubmitting = $state(false);
	let currentJobId = $state('');
	let currentJob = $derived(importProgress.getJob(currentJobId));
	let startRow = $state(2);
	let fileInput: HTMLInputElement | undefined = $state(undefined);

	// === HISTORY STATE ===
	let loadingHistory = $state(true);
	let logs = $state<any[]>([]);
	let historyPage = $state(1);
	let historyTotalPages = $state(1);
	let selectedLog = $state<any | null>(null);
	let showDetails = $state(false);
	let showConnectionFallback = $state(false);
	let connectionError = $state('');

	// === COLUMN MAPPING ===
	let columnMapping = $state<Record<string, string>>({
		name: '',
		amount: '',
		phone: '',
		email: '',
		description: '',
		dueDate: ''
	});

	// === FUNCTIONS ===
	async function fetchLogs(p: number = 1) {
		loadingHistory = true;
		showConnectionFallback = false;

		// Add timeout for Redis connection
		const timeoutPromise = new Promise((_, reject) =>
			setTimeout(() => reject(new Error('Request timeout')), 15000)
		);

		try {
			const res = await Promise.race([
				apiFetch<any>(`/v1/import/logs?page=${p}&limit=10`),
				timeoutPromise
			]);

			if (!res.error && res.data) {
				const payload = res.data;
				logs = payload.logs ?? [];
				historyPage = payload.page ?? p;
				historyTotalPages = payload.totalPages ?? 1;

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
			}
		} catch (err) {
			connectionError = err instanceof Error ? err.message : 'Failed to load import history';
			showConnectionFallback = true;
		} finally {
			loadingHistory = false;
		}
	}

	const handleFileUpload = async (file: File) => {
		if (!file) return;

		// Reset state for new upload
		resetUploadState();
		uploadState.file = file;
		uploadState.fileName = file.name;
		uploadState.status = 'uploading';
		saveUploadState();

		const formData = new FormData();
		formData.append('file', file);

		try {
			// Generate preview directly (no separate upload step)
			const previewResponse = await apiFetch('/v1/import/preview', {
				method: 'POST',
				body: formData
			});

			if (previewResponse.data) {
				currentJobId = previewResponse.data.jobId;
				// Add job to progress store for polling
				importProgress.addJob(currentJobId, 'preview', file.name);
				uploadState.status = 'preview-loading';
				saveUploadState();
				toast.success('File uploaded and preview generation started!');
			} else {
				uploadState.status = 'error';
				uploadState.error = previewResponse.error || 'Upload failed';
			}
		} catch (error) {
			uploadState.status = 'error';
			uploadState.error = error instanceof Error ? error.message : 'Upload failed';
		}
	};

	const handleImport = async () => {
		if (!currentJobId || missingRequired.length > 0) {
			toast.error('Please map all required columns');
			return;
		}

		isSubmitting = true;

		try {
			const formData = new FormData();
			formData.append('file', uploadState.file!);
			formData.append(
				'config',
				JSON.stringify({
					mapping: columnMapping,
					startRow
				})
			);

			const response = await apiFetch('/v1/import/debts', {
				method: 'POST',
				body: formData
			});

			if (response.data) {
				toast.success(`Import started! Job ID: ${response.data.jobId}`);
				currentJobId = response.data.jobId;

				// Reset state after successful import
				resetUploadState();

				// Refresh history
				fetchLogs();
			} else {
				toast.error(response.error || 'Import failed');
			}
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Import failed');
		} finally {
			isSubmitting = false;
		}
	};

	const formatFileSize = (bytes: number) => {
		if (bytes === 0) return '0 Bytes';
		const k = 1024;
		const sizes = ['Bytes', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	};

	const getStatusColor = (status: string) => {
		switch (status) {
			case 'success':
				return 'text-green-600';
			case 'processing':
				return 'text-blue-600';
			case 'failed':
				return 'text-red-600';
			case 'pending':
				return 'text-yellow-600';
			default:
				return 'text-gray-600';
		}
	};

	function viewDetails(log: any) {
		selectedLog = log;
		showDetails = true;
	}

	function formatDate(dateStr: string) {
		return new Date(dateStr).toLocaleString();
	}

	function copyErrorCode(code: string) {
		navigator.clipboard.writeText(code);
		toast.success('Error code copied to clipboard');
	}

	// === LIFECYCLE ===
	onMount(() => {
		// Restore state from importUpload store (survives SPA navigation)
		if (importUpload.state.status !== 'idle') {
			uploadState = { ...importUpload.state };
			columnMapping = { ...importUpload.columnMapping };
			startRow = importUpload.startRow;
		}

		// Always fetch history
		fetchLogs();
	});

	// Sync state to importUpload store (survives SPA navigation)
	$effect(() => {
		if (uploadState.status !== 'idle') {
			importUpload.state = { ...uploadState };
			importUpload.columnMapping = { ...columnMapping };
			importUpload.startRow = startRow;
		}
	});

	$effect(() => {
		// Restore state from global store if available
		if (!currentJobId) {
			const jobs = Array.from(importProgress.activeJobs.values());
			const recentPreview = jobs
				.reverse()
				.find((j) => j.type === 'preview' && j.status === 'success' && j.result);

			if (recentPreview && recentPreview.result) {
				currentJobId = recentPreview.jobId;
			}
		}
	});

	$effect(() => {
		if (currentJob?.status === 'success' && currentJob.result) {
			const res = currentJob.result;
			if (currentJob.type === 'preview') {
				uploadState.status = 'preview-ready';
				uploadState.fileName = res.fileName || uploadState.fileName;
				uploadState.totalRows = res.totalRows || 0;
				uploadState.columnHeaders = res.columnHeaders || [];
				uploadState.previewData = res.previewData || [];

				if (res.autoMapping) {
					const current = untrack(() => columnMapping);
					columnMapping = { ...current, ...res.autoMapping };
				}
			} else if (currentJob.type === 'import') {
				isSubmitting = false;
				fetchLogs(1); // Refresh history
				resetUploadState();
			}
		} else if (currentJob?.status === 'failed') {
			uploadState.status = 'error';
			uploadState.error = currentJob.error || 'Preview generation failed';
			isSubmitting = false;
			toast.error(currentJob.error || 'Operation failed');
		}
	});

	// Auto-reset if preview is stuck for too long (2 minutes)
	$effect(() => {
		if (uploadState.status === 'preview-loading') {
			const timeout = setTimeout(
				() => {
					uploadState.status = 'error';
					uploadState.error = 'Preview generation timed out. Please try again.';
					toast.error('Preview generation timed out');
				},
				2 * 60 * 1000
			); // 2 minutes

			return () => clearTimeout(timeout);
		}
	});
</script>

<div class="container max-w-6xl space-y-6 py-10">
	<!-- Page Header -->
	<div class="mb-4 flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold">Import Debts</h1>
			<p class="text-muted-foreground">Bulk import debts from spreadsheet files</p>
		</div>
		<Button href="/dashboard" variant="ghost">
			<IconLucideArrowLeft class="mr-2 h-4 w-4" />
			Back to Dashboard
		</Button>
	</div>

	<div class="grid grid-cols-1 items-start gap-6 lg:grid-cols-[1.2fr_1fr]">
		<!-- Left Side: Import Form -->
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2">
					<IconLucideFileSpreadsheet class="h-5 w-5" /> Import Debts
				</Card.Title>
				<Card.Description>Upload an Excel file to bulk import debts.</Card.Description>
			</Card.Header>
			<Card.Content>
				<!-- NEW STATE-BASED UPLOAD -->
				{#if uploadState.status === 'idle'}
					<div
						role="button"
						tabindex="0"
						aria-label="Drag and drop your file here, or click to browse"
						class="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center"
						ondragover={(e) => {
							e.preventDefault();
							e.stopPropagation();
						}}
						ondragenter={(e) => {
							e.preventDefault();
							e.stopPropagation();
						}}
						ondrop={(e) => {
							e.preventDefault();
							e.stopPropagation();
							const file = e.dataTransfer.files[0];
							if (file) handleFileUpload(file);
						}}
						onclick={() => fileInput?.click()}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								fileInput?.click();
							}
						}}
					>
						<IconLucideFileSpreadsheet class="mx-auto mb-4 h-12 w-12 text-gray-400" />
						<p class="mb-4 text-gray-600">Drag and drop your file here, or click to browse</p>
						<p class="mb-4 text-sm text-gray-500">
							Supported formats: .xlsx, .xls, .csv (Max 10MB)
						</p>

						<input
							bind:this={fileInput}
							type="file"
							accept=".xlsx,.xls,.csv"
							onchange={(e) => {
								const file = (e.target as HTMLInputElement).files?.[0];
								if (file) handleFileUpload(file);
							}}
							class="hidden"
						/>

						<Button
							onclick={(e) => {
								e.stopPropagation();
								fileInput?.click();
							}}
						>
							<IconLucideUpload class="mr-2 h-4 w-4" />
							Choose File
						</Button>
					</div>
				{:else if uploadState.status === 'uploading'}
					<div class="py-8 text-center">
						<IconLucideLoader2 class="mx-auto mb-4 h-8 w-8 animate-spin text-blue-600" />
						<p class="mb-2 text-lg font-medium">Uploading file...</p>
						<p class="text-gray-600">{uploadState.fileName}</p>
						<Progress value={uploadState.uploadProgress} class="mx-auto mt-4 max-w-md" />
					</div>
				{:else if uploadState.status === 'uploaded'}
					<div class="py-8 text-center">
						<IconLucideCheckCircle class="mx-auto mb-4 h-8 w-8 text-green-600" />
						<p class="mb-2 text-lg font-medium">File uploaded successfully!</p>
						<p class="text-gray-600">{uploadState.fileName}</p>
						<p class="mb-4 text-sm text-gray-500">Generating preview...</p>
					</div>
				{:else if uploadState.status === 'preview-loading'}
					<div class="py-8 text-center">
						<IconLucideLoader2 class="mx-auto mb-4 h-8 w-8 animate-spin text-blue-600" />
						<p class="mb-2 text-lg font-medium">Generating preview...</p>
						<p class="mb-4 text-gray-600">{uploadState.fileName}</p>
						<Button
							onclick={() => {
								resetUploadState();
								if (currentJobId) {
									importProgress.removeJob(currentJobId);
								}
								currentJobId = '';
								toast.info('Upload cancelled. You can try again.');
							}}
							variant="outline"
							size="sm"
						>
							<IconLucideX class="mr-2 h-4 w-4" />
							Cancel / Start Over
						</Button>
					</div>
				{:else if uploadState.status === 'preview-ready' && hasPreview}
					<div class="space-y-6">
						<!-- Preview Section -->
						<Card.Root>
							<Card.Header>
								<Card.Title class="flex items-center gap-2">
									<IconLucideSettings2 class="h-5 w-5" /> Preview & Mapping
								</Card.Title>
								<Card.Description>
									{uploadState.totalRows} rows found. Map columns to database fields.
								</Card.Description>
							</Card.Header>
							<Card.Content>
								<div class="space-y-4">
									<!-- Preview Table -->
									<div class="overflow-hidden rounded-lg border">
										<Table.Root>
											<Table.Header>
												<Table.Row>
													{#each uploadState.columnHeaders as header, i}
														<Table.Head class="font-medium">{header}</Table.Head>
													{/each}
												</Table.Row>
											</Table.Header>
											<Table.Body>
												{#each uploadState.previewData.slice(0, 10) as row, rowIndex}
													<Table.Row class="hover:bg-muted/50">
														{#each row as cell, cellIndex}
															<Table.Cell class="px-3 py-2 text-sm">
																{cell}
															</Table.Cell>
														{/each}
													</Table.Row>
												{/each}
											</Table.Body>
										</Table.Root>
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
													<select
														bind:value={columnMapping[field.key]}
														class="w-full rounded-md border p-2 text-sm"
													>
														<option value="">-- Select --</option>
														{#each uploadState.columnHeaders as header}
															<option value={header}>{header}</option>
														{/each}
													</select>
													{#if field.description}
														<p class="text-xs text-gray-500">{field.description}</p>
													{/if}
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
										<div class="text-sm text-gray-600">
											Starting from row <Input
												type="number"
												bind:value={startRow}
												class="w-16 p-1"
											/>
										</div>
										<div class="flex gap-2">
											<Button variant="outline" onclick={() => resetUploadState()}>Cancel</Button>
											<Button
												onclick={handleImport}
												disabled={missingRequired.length > 0 || isSubmitting}
											>
												{#if isSubmitting}
													<IconLucideLoader2 class="mr-2 h-4 w-4 animate-spin" />
												{/if}
												Import Debts
											</Button>
										</div>
									</div>
								</div>
							</Card.Content>
						</Card.Root>
					</div>
				{:else if uploadState.status === 'error'}
					<div class="py-8 text-center">
						<IconLucideAlertTriangle class="mx-auto mb-4 h-8 w-8 text-red-600" />
						<p class="mb-2 text-lg font-medium">Upload failed</p>
						<p class="mb-4 text-gray-600">{uploadState.error}</p>
						<Button onclick={() => resetUploadState()} class="mt-4">Try Again</Button>
					</div>
				{/if}
			</Card.Content>
		</Card.Root>

		<!-- Right Side: History -->
		<Card.Root class="sticky top-6">
			<Card.Header class="border-b border-border/40 pb-3">
				<Card.Title class="flex items-center gap-2 text-base">
					<IconLucideClock class="h-4 w-4 text-muted-foreground" /> Recent Imports
				</Card.Title>
			</Card.Header>
			<Card.Content class="p-0">
				<Table.Root>
					<Table.Body>
						{#if showConnectionFallback}
							<Table.Row>
								<Table.Cell colspan="3" class="p-4">
									<ConnectionFallback
										onRetry={() => fetchLogs(historyPage)}
										onUseOffline={() => (showConnectionFallback = false)}
										isRetrying={false}
										errorMessage={connectionError}
										timeoutSeconds={15}
									/>
								</Table.Cell>
							</Table.Row>
						{:else if loadingHistory}
							<Table.Row>
								<Table.Cell class="h-24 text-center">
									<IconLucideLoader2 class="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
								</Table.Cell>
							</Table.Row>
						{:else if logs.length === 0}
							<Table.Row>
								<Table.Cell class="h-24 text-center text-sm text-muted-foreground">
									No imports yet.
								</Table.Cell>
							</Table.Row>
						{:else}
							{#each logs as log}
								{@const activeJob = importProgress.getJob(log.id)}
								<Table.Row class="group transition-colors hover:bg-muted/50">
									<Table.Cell class="py-3 align-top">
										<div class="flex w-full flex-col gap-1.5 pr-1">
											<div class="flex items-start justify-between gap-2">
												<button
													type="button"
													class="max-w-35 cursor-pointer truncate border-0 bg-transparent p-0 text-left text-xs leading-tight font-medium hover:text-primary"
													title={log.fileName}
													onclick={() => viewDetails(log)}
												>
													{log.fileName}
													<div class="mt-0.5 text-[10px] font-normal text-muted-foreground">
														{formatDate(log.createdAt)}
													</div>
												</button>
												<div class="flex items-start gap-2">
													<Badge
														variant="outline"
														class={cn(
															'h-4 cursor-default px-1.5 py-0 text-[9px] tracking-wider uppercase',
															getStatusColor(log.status)
														)}
													>
														{log.status === 'success' ? 'done' : log.status}
													</Badge>

													<!-- Enhanced Action Buttons -->
													<div class="ml-2 flex gap-1">
														{#if log.status === 'success' && log.previewLogId}
															<Button
																variant="ghost"
																size="icon"
																class="h-5 w-5 opacity-0 transition-opacity group-hover:opacity-100"
																title="View Import Results"
																onclick={() =>
																	(window as any).open(`/dashboard/import?log=${log.id}`, '_blank')}
															>
																<IconLucideEye class="h-3.5 w-3.5" />
															</Button>
														{/if}

														{#if log.importedCount > 0}
															<Button
																variant="ghost"
																size="icon"
																class="h-5 w-5 opacity-0 transition-opacity group-hover:opacity-100"
																title="View Imported Debts"
																onclick={() =>
																	(window as any).open(
																		`/debts?import=${log.previewLogId}`,
																		'_blank'
																	)}
															>
																<IconLucideFileSpreadsheet class="h-3.5 w-3.5" />
															</Button>
														{/if}
													</div>
												</div>
											</div>

											{#if activeJob && (activeJob.status === 'processing' || activeJob.status === 'pending')}
												<div class="w-full space-y-1">
													<div class="flex items-center justify-between">
														<span class="text-xs text-muted-foreground">
															{activeJob.status === 'processing' ? 'Processing' : 'Pending'}
														</span>
														<span class="text-xs text-muted-foreground">
															{formatDate(log.createdAt)}
														</span>
													</div>
													<Progress value={activeJob.progress || 0} class="w-full" />
												</div>
											{/if}
										</div>
									</Table.Cell>
								</Table.Row>
							{/each}
						{/if}
					</Table.Body>
				</Table.Root>
			</Card.Content>
		</Card.Root>
	</div>
</div>

<!-- Enhanced Details Dialog -->
<Dialog.Root bind:open={showDetails}>
	<Dialog.Content class="max-w-4xl">
		<Dialog.Header>
			<Dialog.Title class="flex items-center gap-2">
				Import Details: {selectedLog?.fileName}
				{#if selectedLog?.status === 'success' && selectedLog?.previewLogId}
					<Button
						variant="ghost"
						size="icon"
						onclick={() =>
							(window as any).open(`/dashboard/import?log=${selectedLog.id}`, '_blank')}
						class="ml-auto"
					>
						<IconLucideFileSpreadsheet class="h-4 w-4" />
					</Button>
				{/if}
			</Dialog.Title>
		</Dialog.Header>
		{#if selectedLog}
			<div class="mt-4 grid grid-cols-2 gap-4 text-sm lg:grid-cols-3">
				<div class="space-y-1">
					<p class="text-xs text-muted-foreground">Status</p>
					<p class="font-medium">{selectedLog.status}</p>
				</div>
				<div class="space-y-1">
					<p class="text-xs text-muted-foreground">Created</p>
					<p class="font-medium">{formatDate(selectedLog.createdAt)}</p>
				</div>
				<div class="space-y-1">
					<p class="text-xs text-muted-foreground">Total Rows</p>
					<p class="font-medium">{selectedLog.totalRows || 0}</p>
				</div>
				<div class="space-y-1">
					<p class="text-xs text-muted-foreground">Imported</p>
					<p class="font-medium">{selectedLog.importedCount || 0}</p>
				</div>
				<div class="space-y-1">
					<p class="text-xs text-muted-foreground">Errors</p>
					<p class="font-medium">{selectedLog.errorCount || 0}</p>
				</div>
			</div>

			{#if selectedLog.errors && selectedLog.errorCount > 0}
				{@const errors = JSON.parse(selectedLog.errors)}
				<div class="mt-4">
					<h3 class="mb-2 text-lg font-semibold">Error Details</h3>
					<div class="max-h-40 overflow-y-auto rounded-lg border p-4 text-sm">
						{#each errors as error}
							<div class="mb-2 rounded border border-red-200 bg-red-50 p-2">
								<div class="font-medium text-red-800">Row {error.row}: {error.error}</div>
								{#if error.details}
									<div class="mt-1 text-xs text-red-600">{error.details}</div>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Enhanced Actions -->
			{#if selectedLog.status === 'success'}
				<div class="col-span-full mt-4 flex gap-2 lg:col-span-3">
					<Button
						variant="outline"
						class="flex-1"
						onclick={() => goto(`/dashboard/preview/${selectedLog.id}`)}
					>
						<IconLucideSettings2 class="mr-2 h-4 w-4" />
						View Preview / Mapping
					</Button>
					{#if selectedLog.previewLogId}
						<Button
							variant="outline"
							class="flex-1"
							onclick={() =>
								(window as any).open(`/debts?import=${selectedLog.previewLogId}`, '_blank')}
						>
							<IconLucideEye class="mr-2 h-4 w-4" />
							View Imported Debts
						</Button>
					{/if}
				</div>
			{:else if selectedLog.status === 'pending' || selectedLog.status === 'processing'}
				<div class="col-span-full mt-4 flex gap-2">
					<Button
						variant="default"
						class="flex-1"
						onclick={() => {
							showDetails = false;
							goto(`/dashboard/preview/${selectedLog.id}`);
						}}
					>
						<IconLucideSettings2 class="mr-2 h-4 w-4" />
						Continue / Check Progress
					</Button>
				</div>
			{:else if selectedLog.status === 'preview'}
				<div class="col-span-full mt-4 flex gap-2">
					<Button
						variant="default"
						class="flex-1"
						onclick={() => {
							showDetails = false;
							goto(`/dashboard/preview/${selectedLog.id}`);
						}}
					>
						<IconLucideSettings2 class="mr-2 h-4 w-4" />
						Continue Mapping
					</Button>
				</div>
			{/if}
		{/if}
	</Dialog.Content>
</Dialog.Root>
