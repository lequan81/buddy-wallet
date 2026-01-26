<script lang="ts">
    import { enhance } from '$app/forms';
    import { untrack } from 'svelte';
    import { Button } from '$lib/components/ui/button';
    import { Input } from '$lib/components/ui/input';
    import { Label } from '$lib/components/ui/label';
    import * as Card from '$lib/components/ui/card';
    import { ArrowLeft, Upload, Loader2, AlertTriangle, CheckCircle, Copy, XCircle, FileSpreadsheet, Settings2 } from '@lucide/svelte';
    import { toast } from 'svelte-sonner';

    let { form } = $props();
    let isSubmitting = $state(false);
    let toastId = $state<string | number | undefined>(undefined);
    let lastLogId = $state('');
    let fileInput = $state<HTMLInputElement>();
    
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
        { key: 'name', label: 'Name/Tên', required: true, description: 'Person who owes' },
        { key: 'amount', label: 'Amount/Số nợ', required: true, description: 'Debt amount' },
        { key: 'phone', label: 'Phone', required: false, description: 'For user linking' },
        { key: 'email', label: 'Email', required: false, description: 'For user linking' },
        { key: 'description', label: 'Description', required: false, description: 'Notes' },
        { key: 'dueDate', label: 'Due Date', required: false, description: 'Deadline' }
    ];

    const missingRequired = $derived(() => {
        return dbFields.filter(f => f.required && !columnMapping[f.key]).map(f => f.label);
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
        if (fileInput) fileInput.value = '';
    }

    // Handle form results
    $effect(() => {
        // Handle preview result
        if (form?.preview && form.logId !== lastLogId) {
            fileName = form.fileName || '';
            totalRows = form.totalRows || 0;
            columnHeaders = form.columnHeaders || [];
            previewData = form.previewData || [];
            lastLogId = form.logId;
            
            // Apply auto-detected mappings (use untrack to prevent infinite loop)
            if (form.autoMapping) {
                const current = untrack(() => columnMapping);
                columnMapping = { ...current, ...form.autoMapping };
            }
            isSubmitting = false;
            
            toast.success(`Loaded ${totalRows} rows from "${fileName}"`);
        }

        // Handle errors
        if (form?.code && form?.message) {
            if (toastId) toast.dismiss(toastId);
            toast.error(`[${form.code}] ${form.message}`, { duration: 8000 });
        } else if (form?.message && !form?.preview && !form?.success) {
            if (toastId) toast.dismiss(toastId);
            toast.error(form.message, { duration: 5000 });
        }
        
        // Handle import success
        if (form?.success) {
            if (toastId) toast.dismiss(toastId);
            const warningCount = form.errors?.length || 0;
            if (warningCount > 0) {
                toast.warning(`Imported ${form.imported} records with ${warningCount} warnings`);
            } else {
                toast.success(`Successfully imported ${form.imported} records!`);
            }
            resetForm();
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
        <ArrowLeft class="mr-2 h-4 w-4" /> Back to Dashboard
    </Button>

    <Card.Root>
        <Card.Header>
            <Card.Title class="flex items-center gap-2">
                <FileSpreadsheet class="h-5 w-5" />
                Import Debts from Excel
            </Card.Title>
            <Card.Description>Upload an Excel file and configure column mapping.</Card.Description>
        </Card.Header>
        <Card.Content class="space-y-6">
            
            <form method="POST" action="?/preview" enctype="multipart/form-data" use:enhance={({ action, formData, cancel }) => {
                const isImport = action.search.includes('import');
                
                if (isImport) {
                    if (missingRequired().length > 0) {
                        toast.error(`Missing required fields: ${missingRequired().join(', ')}`, { duration: 3000 });
                        cancel();
                        return;
                    }
                    if (startRow > totalRows) {
                        toast.error(`Start Row (${startRow}) cannot be larger than Total Rows (${totalRows})`);
                        cancel();
                        return;
                    }
                    console.log('[Frontend] Submitting Import...');
                    formData.set('config', JSON.stringify({ mapping: columnMapping, startRow }));
                } else {
                    // Step 1: Preview Validation
                    const fileInput = formData.get('file') as File;
                    if (!fileInput || fileInput.size === 0) {
                         toast.error("Please select a valid Excel file.");
                         cancel();
                         return;
                    }
                }

                isSubmitting = true;

                return async ({ update, result }) => {
                    await update({ reset: false }); // Prevent form reset to keep file selected
                    isSubmitting = false;
                    if (result.type === 'failure') {
                         console.error('[Frontend] Failure:', result);
                    }
                };
            }}>
                
                <!-- Step 1: File Upload for Preview -->
                <div class:hidden={hasPreview()}>
                    <div class="space-y-4">
                        <Label class="text-base font-semibold">Step 1: Select Excel File</Label>
                        <div class="rounded-lg border-2 border-dashed p-8 text-center bg-muted/30 hover:bg-muted/50 transition-colors">
                            <Label for="file" class="cursor-pointer flex flex-col items-center">
                                {#if selectedFiles && selectedFiles.length > 0}
                                    <FileSpreadsheet class="h-10 w-10 text-primary mb-3" />
                                    <span class="font-medium text-primary">{selectedFiles[0].name}</span>
                                    <span class="text-sm text-muted-foreground mt-1">Click to change</span>
                                {:else}
                                    <Upload class="h-10 w-10 text-muted-foreground mb-3" />
                                    <span class="font-medium">Click to select file or drag & drop</span>
                                    <span class="text-sm text-muted-foreground mt-1">.xlsx files only</span>
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
                            <Button type="submit" formaction="?/preview" disabled={isSubmitting}>
                                {#if isSubmitting && !hasPreview()}
                                    <div class="animate-spin mr-2">
                                        <Loader2 class="h-4 w-4" />
                                    </div> Analyzing...
                                {:else}
                                    <Upload class="mr-2 h-4 w-4" /> Analyze File
                                {/if}
                            </Button>
                        </div>
                    </div>
                </div>

                <!-- Step 2: Preview & Mapping -->
                <div class:hidden={!hasPreview()}>
                    <!-- File Info -->
                    <div class="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/20 mb-6">
                        <div class="flex items-center gap-3">
                            <CheckCircle class="h-5 w-5 text-primary" />
                            <div>
                                <p class="font-medium">{fileName}</p>
                                <p class="text-xs text-muted-foreground">{totalRows} rows, {columnHeaders.length} columns</p>
                            </div>
                        </div>
                        <Button type="button" variant="outline" size="sm" onclick={resetForm}>
                            Change File
                        </Button>
                    </div>

                    <!-- Data Preview -->
                    <div class="space-y-2 mb-6">
                        <Label class="text-sm font-semibold">Preview (First {previewData.length} rows)</Label>
                        <div class="border rounded-lg overflow-x-auto max-h-48">
                            <table class="w-full text-xs">
                                <thead class="bg-muted/50 sticky top-0">
                                    <tr>
                                        <th class="px-2 py-1.5 text-left font-medium text-muted-foreground w-8">#</th>
                                        {#each columnHeaders as col}
                                            <th class="px-2 py-1.5 text-left font-semibold min-w-16">{col}</th>
                                        {/each}
                                    </tr>
                                </thead>
                                <tbody class="divide-y">
                                    {#each previewData as row, i}
                                        <tr class="{i === 0 ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''}">
                                            <td class="px-2 py-1 text-muted-foreground">{i + 1}</td>
                                            {#each row as cell}
                                                <td class="px-2 py-1 truncate max-w-24">{cell || '—'}</td>
                                            {/each}
                                        </tr>
                                    {/each}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Column Mapping -->
                    <div class="space-y-3 mb-6">
                        <Label class="text-sm font-semibold flex items-center gap-2">
                            <Settings2 class="h-4 w-4" />
                            Column Mapping
                        </Label>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {#each dbFields as field}
                                <div class="flex items-center gap-2 p-2 rounded border bg-card {field.required && !columnMapping[field.key] ? 'border-destructive/50 bg-destructive/5' : ''}">
                                    <div class="flex-1 min-w-0">
                                        <span class="text-sm font-medium">{field.label}</span>
                                        {#if field.required}
                                            <span class="text-destructive">*</span>
                                        {/if}
                                    </div>
                                    <select 
                                        bind:value={columnMapping[field.key]}
                                        class="w-16 px-2 py-1 text-sm rounded border bg-background"
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
                    <div class="flex items-center gap-3 mb-6">
                        <Label for="startRow" class="text-sm whitespace-nowrap">Data starts at row:</Label>
                        <Input type="number" bind:value={startRow} class="w-16 h-8" />
                        <span class="text-xs text-muted-foreground">(Skip header rows)</span>
                    </div>

                    <!-- Missing Fields Warning -->
                    {#if missingRequired().length > 0}
                        <div class="bg-destructive/10 text-destructive p-3 rounded-lg border border-destructive/20 flex items-start gap-2 mb-6">
                            <AlertTriangle class="h-4 w-4 mt-0.5" />
                            <div class="text-sm">
                                <p class="font-semibold">Missing required fields</p>
                                <p class="text-xs">{missingRequired().join(', ')}</p>
                            </div>
                        </div>
                    {/if}

                    <Button type="submit" formaction="?/import" class="w-full" disabled={isSubmitting || missingRequired().length > 0}>
                        {#if isSubmitting}
                            <div class="animate-spin mr-2">
                                <Loader2 class="h-4 w-4" />
                            </div> Importing...
                        {:else}
                            <Upload class="mr-2 h-4 w-4" /> Import {totalRows - startRow + 1} Records
                        {/if}
                    </Button>
                </div>
            </form>
 
            <!-- Error Display -->
            {#if form?.code && !form?.preview}
                <div class="bg-destructive/10 text-destructive p-4 rounded-md text-sm border border-destructive/20">
                    <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center gap-2 font-semibold">
                            <XCircle class="h-4 w-4" />
                            Error
                        </div>
                        <button 
                            type="button"
                            onclick={() => copyErrorCode(form?.code || '')}
                            class="flex items-center gap-1 text-xs bg-destructive/20 px-2 py-1 rounded hover:bg-destructive/30"
                        >
                            <Copy class="h-3 w-3" />
                            {form.code}
                        </button>
                    </div>
                    <p>{form.message}</p>
                </div>
            {/if}

            <!-- Warnings -->
            {#if form?.errors && form.errors.length > 0}
                <div class="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 p-4 rounded-md text-sm border border-yellow-500/20">
                    <div class="flex items-center gap-2 mb-2 font-semibold">
                        <AlertTriangle class="h-4 w-4" />
                        Warnings ({form.errors.length})
                    </div>
                    <ul class="list-none space-y-1 max-h-32 overflow-y-auto font-mono text-xs">
                        {#each form.errors as err, i}
                            <li>#{i + 1} {err}</li>
                        {/each}
                    </ul>
                </div>
            {/if}

            <!-- Success -->
            {#if form?.success}
                <div class="bg-green-500/10 text-green-700 dark:text-green-400 p-4 rounded-md border border-green-500/20">
                    <div class="flex items-center gap-2 font-semibold">
                        <CheckCircle class="h-4 w-4" />
                        Import Complete — {form.imported} records created
                    </div>
                </div>
            {/if}
        </Card.Content>
    </Card.Root>
</div>
