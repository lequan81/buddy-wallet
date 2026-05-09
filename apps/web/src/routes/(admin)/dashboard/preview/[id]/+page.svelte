<script lang="ts">
	import { resolve } from '$app/paths';
	import { 
		ArrowLeft, 
		FileSpreadsheet, 
		CheckCircle, 
		XCircle, 
		Clock,
		Loader2,
		Eye,
		Settings2,
		HelpCircle,
		Upload,
		Info,
		AlertCircle
	} from '@repo/icons';
	import { Button } from '@repo/ui/components/ui/button';
	import * as Card from '@repo/ui/components/ui/card';
	import { Badge } from '@repo/ui/components/ui/badge';
	import { Progress } from '@repo/ui/components/ui/progress';
	import { Input } from '@repo/ui/components/ui/input';
	import { Label } from '@repo/ui/components/ui/label';
	import * as Select from '@repo/ui/components/ui/select';
	import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@repo/ui/components/ui/table';
	import { formatDate } from '$lib/utils/status';
	import { IMPORT_DB_FIELDS } from '@repo/config/shared';
	import { importProgress } from '$lib/stores/import-progress.svelte';
	import * as m from '$lib/paraglide/messages';
	import { toast } from 'svelte-sonner';
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();

	let log = $derived(data.importLog as import('@repo/types').ImportLog);
	let progress = $derived(data.progress as import('@repo/types').ImportProgress | null);

	// --- Interactive State ---
	let localMapping = $state<Record<string, string>>({});
	let localStartRow = $state(2);
	let lastSyncedId = $state<string | null>(null);
	let selectedFile = $state<File | null>(null);
	let isSubmitting = $state(false);
	let isEditingMapping = $state(false);
	let fileInput = $state<HTMLInputElement>();

	// Re-initialize mapping if log changes (e.g. navigating between logs)
	$effect(() => {
		const currentId = log?.id;
		if (currentId && currentId !== lastSyncedId) {
			untrack(() => {
				localMapping = log.columnMapping ? { ...log.columnMapping } : {};
				localStartRow = log.startRow ?? 2;
				lastSyncedId = currentId;
			});
		}
	});

	// Check if we have the file in cache
	let cachedFile = $derived(log ? importProgress.fileCache.get(log.id) : null);
	let hasFile = $derived(!!cachedFile || !!selectedFile);
	let activeFile = $derived(selectedFile || cachedFile);

	// Status helpers
	const getStatusConfig = (status: string) => {
		switch (status) {
			case 'success': return { icon: CheckCircle, color: 'text-green-600', label: 'Completed', badge: 'default' };
			case 'failed': return { icon: XCircle, color: 'text-red-600', label: 'Failed', badge: 'destructive' };
			case 'processing': return { icon: Loader2, color: 'text-blue-600', label: 'Processing', badge: 'secondary' };
			case 'queued': return { icon: Clock, color: 'text-yellow-600', label: 'Queued', badge: 'secondary' };
			case 'preview': return { icon: FileSpreadsheet, color: 'text-purple-600', label: 'Waiting', badge: 'outline' };
			default: return { icon: Clock, color: 'text-yellow-600', label: 'Waiting', badge: 'secondary' };
		}
	};

	let statusConfig = $derived(getStatusConfig(log?.status || 'pending'));

	let errors = $derived.by(() => {
		if (!log?.errors) return [];
		return Array.isArray(log.errors) ? log.errors : [];
	});

	let progressPercentage = $derived(progress?.percentage || 0);
	let canResumeMapping = $derived(
		log
			? log.status !== 'success' || ((log.importedCount ?? 0) === 0 && (log.errorCount ?? 0) === 0)
			: false
	);

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
		dbFields.filter((f) => f.required && !localMapping[f.key]).map((f) => f.label)
	);

	function handleFileSelect(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (file) selectedFile = file;
	}
</script>

<svelte:head>
	<title>{log?.fileName || 'Import Details'} | Buddy Wallet</title>
</svelte:head>

<div class="container max-w-6xl space-y-8 py-10">
	<!-- Top Bar -->
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-4">
			<Button href={resolve(`/dashboard/import`, {})} variant="ghost" size="icon" class="rounded-full hover:bg-muted transition-all">
				<ArrowLeft class="h-5 w-5" />
			</Button>
			<div>
				<h1 class="text-3xl font-bold tracking-tight">Import Detail</h1>
				<div class="flex items-center gap-2 text-sm text-muted-foreground">
					<span class="bg-muted px-2 py-0.5 rounded font-mono text-xs">#{log?.id?.slice(0, 8) || '...'}</span>
					<span class="opacity-30">•</span>
					<span class="font-medium text-foreground">{log?.fileName || '...'}</span>
				</div>
			</div>
		</div>
		<Badge variant={statusConfig.badge as 'default' | 'secondary' | 'destructive' | 'outline'} class="px-4 py-1.5 text-sm font-semibold shadow-sm">
			<statusConfig.icon class="mr-2 h-4 w-4 {statusConfig.color} {log.status === 'processing' ? 'animate-spin' : ''}" />
			{statusConfig.label}
		</Badge>
	</div>

	{#if !log}
		<Card.Root class="border-dashed">
			<Card.Content class="py-24 text-center">
				<Loader2 class="mx-auto mb-4 h-10 w-10 animate-spin text-primary/50" />
				<p class="text-xl font-medium text-muted-foreground italic">Syncing import data...</p>
			</Card.Content>
		</Card.Root>
	{:else}
		<div class="grid gap-8 lg:grid-cols-[1fr_380px]">
			<!-- Main Content Area -->
			<div class="space-y-8">
				
				<!-- 1. File Samples (Always at top for context) -->
				{#if log.previewData && log.previewData.length > 0}
					<Card.Root>
						<Card.Header class="pb-3 flex-row items-center justify-between space-y-0">
							<div class="space-y-1">
								<Card.Title class="flex items-center gap-2">
									<Eye class="h-4 w-4 text-muted-foreground" /> File Samples
								</Card.Title>
								<Card.Description>First {log.previewData.length} rows from your file</Card.Description>
							</div>
							<Badge variant="outline" class="font-mono text-[10px] uppercase">Spreadsheet Preview</Badge>
						</Card.Header>
						<Card.Content class="p-0 border-t">
							<div class="overflow-x-auto">
								<Table>
									<TableHeader class="bg-muted/30">
										<TableRow>
											{#each log.columnHeaders || [] as header}
												<TableHead class="font-bold text-foreground py-2 px-4 border-r last:border-0">{header}</TableHead>
											{/each}
										</TableRow>
									</TableHeader>
									<TableBody>
										{#each log.previewData as row}
											<TableRow class="hover:bg-muted/10 transition-colors">
												{#each row as cell}
													<TableCell class="max-w-[150px] truncate border-r last:border-0 text-xs py-2 px-4">{cell || '-'}</TableCell>
												{/each}
											</TableRow>
										{/each}
									</TableBody>
								</Table>
							</div>
						</Card.Content>
					</Card.Root>
				{/if}

				<!-- 2. Interactive Mapping Section -->
				{#if canResumeMapping}
					{#if isEditingMapping}
						<Card.Root class="overflow-hidden border-2 border-primary shadow-xl animate-in zoom-in-95 duration-200">
							<Card.Header class="bg-primary/5 border-b">
								<div class="flex items-center justify-between">
									<Card.Title class="flex items-center gap-2 text-primary">
										<Settings2 class="h-5 w-5" /> Detailed Column Mapping
									</Card.Title>
									{#if hasFile}
										<Badge variant="default" class="bg-green-100 text-green-700">File Connected</Badge>
									{/if}
								</div>
							</Card.Header>
							<Card.Content class="p-6 space-y-6">
								{#if !hasFile}
									<div class="rounded-xl border-2 border-dashed border-red-200 bg-red-50/30 p-8 text-center">
										<Upload class="mx-auto mb-4 h-10 w-10 text-red-400" />
										<p class="text-xs text-red-800/70 mb-4">Please re-select: <strong>{log.fileName}</strong></p>
										<input type="file" bind:this={fileInput} onchange={handleFileSelect} class="hidden" />
										<Button size="sm" variant="destructive" onclick={() => fileInput?.click()}>Select File</Button>
									</div>
								{:else}
									<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
										{#each dbFields as field}
											<div class="space-y-1.5">
												<Label class="text-xs font-bold">{field.label} {field.required ? '*' : ''}</Label>
												<Select.Root bind:value={localMapping[field.key]}>
													<Select.Trigger class="w-full">
														<Select.Value placeholder="-- No Mapping --" />
													</Select.Trigger>
													<Select.Content>
														{#each log.columnHeaders || [] as header}
															<Select.Item value={header} label={header} />
														{/each}
													</Select.Content>
												</Select.Root>
											</div>
										{/each}
									</div>

									<div class="flex items-center justify-between pt-6 border-t gap-4">
										<div class="flex items-center gap-3">
											<Label class="text-xs font-bold">Start Row</Label>
											<Input type="number" min="1" bind:value={localStartRow} class="w-16 h-8 text-center" />
										</div>
										<div class="flex items-center gap-2">
											<Button variant="ghost" size="sm" onclick={() => isEditingMapping = false}>Cancel</Button>
											<form 
												method="POST" 
												action="?/import" 
												use:enhance={({ formData }) => {
													isSubmitting = true;
													formData.append('file', activeFile!);
													formData.append('config', JSON.stringify({ mapping: localMapping, startRow: localStartRow }));
													formData.append('previewLogId', log.id);
													return async ({ result }) => {
														isSubmitting = false;
														if (result.type === 'success') {
															toast.success('Import started!');
															isEditingMapping = false;
														} else if (result.type === 'failure') {
															const failureData = result.data as { message?: string };
															toast.error(failureData?.message || 'Import failed');
														}
													};
												}}
											>
												<Button type="submit" size="sm" disabled={missingRequired.length > 0 || isSubmitting}>
													{isSubmitting ? 'Starting...' : 'Confirm & Import'}
												</Button>
											</form>
										</div>
									</div>
								{/if}
							</Card.Content>
						</Card.Root>
					{:else}
						<Card.Root class="bg-primary/5 border-dashed border-2 border-primary/20">
							<Card.Content class="p-6 flex items-center justify-between gap-4">
								<div class="space-y-1">
									<h3 class="font-bold text-sm">Need to update column mapping?</h3>
									<p class="text-xs text-muted-foreground">You can change how spreadsheet columns are mapped to database fields.</p>
								</div>
								<Button onclick={() => isEditingMapping = true} size="sm" class="shrink-0">
									<Settings2 class="mr-2 h-4 w-4" /> Start Mapping
								</Button>
							</Card.Content>
						</Card.Root>
					{/if}
				{/if}

				<!-- 3. Active Progress -->
				{#if log.status === 'processing'}
					<Card.Root class="border-blue-200 bg-blue-50/20">
						<Card.Content class="p-6 space-y-4">
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-2">
									<Loader2 class="h-5 w-5 animate-spin text-blue-600" />
									<span class="font-bold text-blue-900">{progress?.message || 'Processing...'}</span>
								</div>
								<Badge variant="secondary" class="font-mono">{progressPercentage}%</Badge>
							</div>
							<Progress value={progressPercentage} class="h-2 bg-blue-100" />
						</Card.Content>
					</Card.Root>
				{/if}

				<!-- 4. Stats -->
				<div class="grid gap-4 grid-cols-2 lg:grid-cols-4">
					<div class="p-4 rounded-xl bg-muted/20 border text-center">
						<p class="text-[10px] uppercase font-bold text-muted-foreground mb-1">Total</p>
						<p class="text-2xl font-black">{log.totalRows || 0}</p>
					</div>
					<div class="p-4 rounded-xl bg-green-500/5 border border-green-500/20 text-center">
						<p class="text-[10px] uppercase font-bold text-green-600 mb-1">Success</p>
						<p class="text-2xl font-black text-green-600">{log.importedCount || 0}</p>
					</div>
					<div class="p-4 rounded-xl bg-red-500/5 border border-red-500/20 text-center">
						<p class="text-[10px] uppercase font-bold text-red-600 mb-1">Errors</p>
						<p class="text-2xl font-black text-red-600">{log.errorCount || 0}</p>
					</div>
					<div class="p-4 rounded-xl bg-muted/20 border text-center">
						<p class="text-[10px] uppercase font-bold text-muted-foreground mb-1">Rate</p>
						<p class="text-2xl font-black">{log.totalRows ? Math.round(((log.importedCount || 0) / log.totalRows) * 100) : 0}%</p>
					</div>
				</div>

				<!-- 5. Applied Mapping (Read-only view) -->
				<Card.Root>
					<Card.Header class="pb-3 flex-row items-center justify-between space-y-0">
						<Card.Title class="text-sm flex items-center gap-2">
							<CheckCircle class="h-4 w-4 text-muted-foreground" /> Mapping Configuration
						</Card.Title>
						<Badge variant="secondary" class="text-[10px] uppercase">Review</Badge>
					</Card.Header>
					<Card.Content class="p-4 border-t">
						<div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
							{#each dbFields as field}
								<div class="flex items-center justify-between rounded-lg bg-muted/30 p-2 text-xs">
									<span class="font-medium">{field.label}</span>
									<span class="font-mono text-[10px] bg-background px-1.5 py-0.5 rounded border">
										{log.columnMapping?.[field.key] || '-'}
									</span>
								</div>
							{/each}
						</div>
					</Card.Content>
				</Card.Root>

				<!-- 6. Errors -->
				{#if errors.length > 0}
					<Card.Root class="border-red-500/20 bg-red-500/5">
						<Card.Header>
							<Card.Title class="text-sm font-bold text-red-600 flex items-center gap-2">
								<AlertCircle class="h-4 w-4" /> Import Issues ({errors.length})
							</Card.Title>
						</Card.Header>
						<Card.Content class="space-y-2 max-h-[300px] overflow-auto pr-2 scrollbar-thin">
							{#each errors as err, i}
								<div class="p-3 text-xs bg-background border rounded-lg flex gap-3">
									<span class="font-bold text-red-500">{i + 1}.</span>
									<span>{err}</span>
								</div>
							{/each}
						</Card.Content>
					</Card.Root>
				{/if}
			</div>

			<!-- Sidebar / Meta -->
			<div class="space-y-6">
				<!-- Single Sidebar Card to avoid overlaps -->
				<Card.Root class="sticky top-6">
					<Card.Header>
						<Card.Title class="text-lg flex items-center gap-2">
							<Info class="h-4 w-4 text-muted-foreground" /> Overview
						</Card.Title>
					</Card.Header>
					<Card.Content class="space-y-6">
						<!-- Metadata -->
						<div class="grid grid-cols-2 gap-4 border-b pb-6">
							<div class="space-y-1">
								<p class="text-[10px] text-muted-foreground uppercase font-black">Managed By</p>
								<p class="text-xs font-mono truncate">{log.userId?.slice(0, 8) || '...'}</p>
							</div>
							<div class="space-y-1 text-right">
								<p class="text-[10px] text-muted-foreground uppercase font-black">File Size</p>
								<p class="text-xs font-bold">{(log.fileSize / 1024 / 1024).toFixed(3)} MB</p>
							</div>
							<div class="space-y-1">
								<p class="text-[10px] text-muted-foreground uppercase font-black">Created</p>
								<p class="text-[10px] font-bold">{formatDate(log.createdAt)}</p>
							</div>
							<div class="space-y-1 text-right">
								<p class="text-[10px] text-muted-foreground uppercase font-black">Status</p>
								<p class="text-[10px] font-bold uppercase">{log.status}</p>
							</div>
						</div>

						<!-- Help Section (Integrated info Card to avoid overlap) -->
						<div class="rounded-xl bg-linear-to-br from-primary/10 to-blue-500/5 p-4 border border-primary/10 space-y-3">
							<div class="flex items-center gap-2">
								<HelpCircle class="h-4 w-4 text-primary/60" />
								<p class="text-xs font-black">Need more help?</p>
							</div>
							<p class="text-[10px] text-muted-foreground leading-relaxed italic">Check our documentation on import formats and field requirements.</p>
							<Button variant="outline" size="sm" class="w-full h-8 text-[10px] bg-background/50">Read Docs</Button>
						</div>
					</Card.Content>
				</Card.Root>
			</div>
		</div>
	{/if}
</div>
