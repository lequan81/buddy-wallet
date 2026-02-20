<script lang="ts">
	// @ts-nocheck
	import { onMount } from 'svelte';
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
	import { cn } from '$lib/utils';

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

	let { form } = $props();

	// === IMPORT FORM STATE ===
	let isSubmitting = $state(false);
	let isAnalyzing = $state(false);
	let lastLogId = $state('');
	let previewLogId = $state('');
	let fileInput = $state<HTMLInputElement>();

	let previewData = $state<string[][]>([]);
	let columnHeaders = $state<string[]>([]);
	let fileName = $state('');
	let totalRows = $state(0);
	let startRow = $state(2);
	let selectedFiles = $state<FileList>();
	let storedFile: File | null = null;
	let currentJobId = $state('');
	let currentJob = $derived(importProgress.getJob(currentJobId));

	let columnMapping = $state<Record<string, string>>({
		name: '',
		amount: '',
		phone: '',
		email: '',
		description: '',
		dueDate: ''
	});

	const dbFields = [
		{ key: 'name', label: 'Name/Tên', required: true, description: 'Person who owes' },
		{ key: 'amount', label: 'Amount/Số nợ', required: true, description: 'Debt amount' },
		{ key: 'phone', label: 'Phone', required: true, description: 'For user linking' },
		{ key: 'email', label: 'Email', required: false, description: 'For user linking' },
		{ key: 'description', label: 'Description', required: false, description: 'Notes' },
		{ key: 'dueDate', label: 'Due Date', required: false, description: 'Deadline' }
	];

	let missingRequired = $derived(
		dbFields.filter((f) => f.required && !columnMapping[f.key]).map((f) => f.label)
	);
	let hasPreview = $derived(previewData.length > 0);

	// === HISTORY STATE ===
	let loadingHistory = $state(true);
	let logs = $state<any[]>([]);
	let historyPage = $state(1);
	let historyTotalPages = $state(1);
	let selectedLog = $state<any | null>(null);
	let showDetails = $state(false);

	async function fetchLogs(p: number = 1) {
		loadingHistory = true;
		try {
			const res = await apiFetch<any>(`/v1/import/logs?page=${p}&limit=10`);
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
		} finally {
			loadingHistory = false;
		}
	}

	onMount(() => {
		fetchLogs();
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
			} else if (currentJob.type === 'import') {
				isSubmitting = false;
				// The history will natively handle showing progress and completion.
				fetchLogs(1); // Refresh history
				resetForm();
			}
		} else if (currentJob?.status === 'failed') {
			isAnalyzing = false;
			isSubmitting = false;
			toast.error(currentJob.error || 'Operation failed');
		}
	});

	function handleFileSelect(e: Event & { currentTarget: HTMLInputElement }) {
		if (e.currentTarget.files && e.currentTarget.files.length > 0) {
			selectedFiles = e.currentTarget.files;
			storedFile = e.currentTarget.files[0];
			fileName = storedFile.name;
			e.currentTarget.form?.requestSubmit(); // Auto-submit preview
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
		columnMapping = { name: '', amount: '', phone: '', email: '', description: '', dueDate: '' };
		if (fileInput) fileInput.value = '';
		currentJobId = '';
	}

	function copyErrorCode(code: string) {
		navigator.clipboard.writeText(code);
		toast.success('Error code copied to clipboard');
	}

	function formatDate(dateStr: string) {
		return new Date(dateStr).toLocaleString();
	}
	function getStatusColor(status: string) {
		switch (status) {
			case 'success':
				return 'bg-green-500/10 text-green-700 dark:text-green-400 hover:bg-green-500/20';
			case 'failed':
				return 'bg-destructive/10 text-destructive hover:bg-destructive/20';
			case 'processing':
				return 'bg-blue-500/10 text-blue-700 dark:text-blue-400 hover:bg-blue-500/20';
			default:
				return 'bg-muted text-muted-foreground hover:bg-muted/80';
		}
	}
	function viewDetails(log: any) {
		selectedLog = log;
		showDetails = true;
	}
</script>

<div class="container max-w-6xl space-y-6 py-10">
	<Button variant="ghost" href="/dashboard" class="-mb-2 pl-0 hover:bg-transparent">
		<IconLucideArrowLeft class="mr-2 h-4 w-4" /> Back to Dashboard
	</Button>

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
									importProgress.addJob(d.jobId, 'import', fileName);
									toast.info('Import started');
									resetForm();
									fetchLogs(1);
								} else {
									isSubmitting = false;
									toast.error(result.data?.message || 'Failed to start import');
								}
							};
						} else {
							const fileInput = formData.get('file') as File;
							if (!fileInput || fileInput.size === 0) {
								toast.error('Please select a valid Excel file.');
								cancel();
								return;
							}
							isAnalyzing = true;
							return async ({ result }) => {
								if (result.type === 'success' && result.data?.success) {
									const d = result.data as any;
									currentJobId = d.jobId;
									importProgress.addJob(d.jobId, 'preview', fileInput.name);
								} else {
									isAnalyzing = false;
									toast.error(result.data?.message || 'Failed to start analysis');
								}
							};
						}
					}}
				>
					<!-- Step 1: Upload -->
					{#if !hasPreview}
						<div class="space-y-4" transition:slide={{ duration: 300 }}>
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
										<span class="mt-1 text-sm text-muted-foreground">.xlsx or .csv files</span>
									{/if}
								</Label>
							</div>
						</div>
					{/if}

					<Input
						id="file"
						name="file"
						type="file"
						accept=".xlsx,.csv"
						class="hidden"
						onchange={handleFileSelect}
						bind:this={fileInput as any}
					/>

					<!-- Step 2: Mapping -->
					{#if hasPreview}
						<div transition:slide={{ duration: 300 }} class="mt-2 text-sm">
							<div
								class="mb-4 flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 p-3"
							>
								<div class="flex items-center gap-3">
									<IconLucideCheckCircle class="h-5 w-5 text-primary" />
									<div>
										<p class="font-medium">{fileName}</p>
										<p class="text-xs text-muted-foreground">{totalRows} rows</p>
									</div>
								</div>
								<Button type="button" variant="outline" size="sm" onclick={resetForm}
									>Change File</Button
								>
							</div>

							<!-- Mapping -->
							<div class="mb-6 flex flex-col space-y-3">
								<Label class="flex items-center gap-2 font-semibold">
									<IconLucideSettings2 class="h-4 w-4" /> Column Mapping
								</Label>
								<div class="grid grid-cols-1 gap-2">
									{#each dbFields as field}
										<div
											class={cn(
												'flex items-center justify-between gap-2 rounded border bg-card p-2',
												field.required &&
													!columnMapping[field.key] &&
													'border-destructive/50 bg-destructive/5'
											)}
										>
											<div>
												<span class="text-xs font-medium whitespace-nowrap"
													>{field.label} {field.required ? '*' : ''}</span
												>
											</div>
											<select
												bind:value={columnMapping[field.key]}
												class="w-45 overflow-hidden rounded border bg-background p-1 text-xs text-ellipsis"
											>
												<option value="">— Skip —</option>
												{#each columnHeaders as col}<option value={col}>{col}</option>{/each}
											</select>
										</div>
									{/each}
								</div>
							</div>

							<div class="mb-6 flex items-center justify-between gap-2 border-t pt-4">
								<Label for="startRow" class="whitespace-nowrap">Start at row:</Label>
								<Input type="number" bind:value={startRow} class="h-8 w-16" />
							</div>

							<Button
								type="submit"
								formaction="?/import"
								class="mt-4 w-full"
								disabled={isSubmitting || missingRequired.length > 0}
							>
								{#if isSubmitting}
									<IconLucideLoader2 class="mr-2 h-4 w-4 animate-spin" /> Importing...
								{:else}
									<IconLucideSend class="mr-2 h-4 w-4" /> Start Import
								{/if}
							</Button>
						</div>
					{/if}
				</form>

				<!-- Error Display -->
				{#if form?.code && !form?.preview}
					<div
						class="mt-4 rounded-md border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive"
						transition:fade
					>
						<div class="mb-2 flex items-center justify-between">
							<div class="flex items-center gap-2 font-semibold">
								<IconLucideXCircle class="h-4 w-4" /> Error
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
						class="mt-4 rounded-md border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm text-yellow-700 dark:text-yellow-400"
					>
						<div class="mb-2 flex items-center gap-2 font-semibold">
							<IconLucideAlertTriangle class="h-4 w-4" /> Warnings ({form.errors.length})
						</div>
						<ul class="max-h-32 list-none space-y-1 overflow-y-auto font-mono text-xs">
							{#each form.errors as err, i}<li>#{i + 1} {err}</li>{/each}
						</ul>
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
						{#if loadingHistory}
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
								{@const activeJob = importProgress.activeJobs.get(log.id)}
								<Table.Row class="group">
									<Table.Cell class="py-3 align-top">
										<div class="flex w-full flex-col gap-1.5 pr-1">
											<div class="flex items-start justify-between gap-2">
												<div
													class="max-w-35 truncate text-xs leading-tight font-medium"
													title={log.fileName}
												>
													{log.fileName}
													<div class="mt-0.5 text-[10px] font-normal text-muted-foreground">
														{formatDate(log.createdAt)}
													</div>
												</div>
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
													<Button
														variant="ghost"
														size="icon"
														class="-mt-0.5 h-5 w-5 opacity-0 transition-opacity group-hover:opacity-100"
														onclick={() => viewDetails(log)}
													>
														<IconLucideEye class="h-3.5 w-3.5" />
													</Button>
												</div>
											</div>

											{#if activeJob && (activeJob.status === 'processing' || activeJob.status === 'pending')}
												<div class="w-full space-y-1">
													<Progress
														value={activeJob.progress.percentage || 0}
														max={100}
														class="h-1.5 bg-muted-foreground/20"
													/>
													<div class="flex justify-between text-[9px] text-muted-foreground">
														<span class="max-w-32.5 truncate"
															>{activeJob.message || 'working...'}</span
														>
														<span>{Math.round(activeJob.progress.percentage || 0)}%</span>
													</div>
												</div>
											{:else if log.status === 'success'}
												<div class="flex justify-between text-[10px] text-muted-foreground">
													<span>
														<span class="font-medium text-green-600 dark:text-green-500"
															>{log.importedCount}</span
														>
														/ {log.totalRows} <span class="opacity-70">imported</span>
													</span>
													{#if log.errorCount > 0}
														<span class="flex items-center gap-1 font-medium text-destructive">
															<IconLucideAlertTriangle class="h-3 w-3" />
															{log.errorCount} skips
														</span>
													{/if}
												</div>
											{/if}
										</div>
									</Table.Cell>
								</Table.Row>
							{/each}
						{/if}
					</Table.Body>
				</Table.Root>

				{#if historyTotalPages > 1}
					<div class="flex items-center justify-between border-t bg-muted/10 p-2">
						<Button
							variant="outline"
							size="sm"
							class="h-6 px-2 text-[10px]"
							onclick={() => fetchLogs(historyPage - 1)}
							disabled={historyPage <= 1 || loadingHistory}
						>
							<IconLucideChevronLeft class="mr-1 h-3 w-3" /> Prev
						</Button>
						<span class="text-[10px] text-muted-foreground"
							>Pg {historyPage} of {historyTotalPages}</span
						>
						<Button
							variant="outline"
							size="sm"
							class="h-6 px-2 text-[10px]"
							onclick={() => fetchLogs(historyPage + 1)}
							disabled={historyPage >= historyTotalPages || loadingHistory}
						>
							Next <IconLucideChevronRight class="ml-1 h-3 w-3" />
						</Button>
					</div>
				{/if}
			</Card.Content>
		</Card.Root>
	</div>
</div>

<Dialog.Root bind:open={showDetails}>
	<Dialog.Content class="max-w-xl">
		<Dialog.Header>
			<Dialog.Title>Import Details</Dialog.Title>
		</Dialog.Header>
		{#if selectedLog}
			<div class="mt-2 grid grid-cols-2 gap-4 text-sm">
				<div>
					<span class="text-muted-foreground">File:</span>
					<p class="truncate font-medium" title={selectedLog.fileName}>{selectedLog.fileName}</p>
				</div>
				<div>
					<span class="text-muted-foreground">Status:</span>
					<p class="font-medium capitalize">{selectedLog.status}</p>
				</div>
				<div>
					<span class="text-muted-foreground">Date:</span>
					<p class="font-medium">{formatDate(selectedLog.createdAt)}</p>
				</div>
				<div>
					<span class="text-muted-foreground">Imported Rows:</span>
					<p class="font-medium">{selectedLog.importedCount} / {selectedLog.totalRows}</p>
				</div>
			</div>
			{#if selectedLog.errors && selectedLog.errorCount > 0}
				{@const errors = JSON.parse(selectedLog.errors)}
				<div class="mt-4 rounded-md border border-destructive/20 bg-destructive/10 p-4">
					<h4 class="mb-2 flex items-center gap-2 text-sm font-semibold text-destructive">
						<IconLucideAlertTriangle class="h-4 w-4" /> Warnings ({errors.length})
					</h4>
					<ul
						class="max-h-40 list-inside list-disc overflow-y-auto font-mono text-xs text-destructive/80"
					>
						{#each Array.isArray(errors) ? errors : [errors] as error}<li>{error}</li>{/each}
					</ul>
				</div>
			{/if}
		{/if}
	</Dialog.Content>
</Dialog.Root>
