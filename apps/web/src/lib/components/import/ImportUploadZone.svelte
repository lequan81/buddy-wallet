<script lang="ts">
	import FileSpreadsheet from '~icons/lucide/file-spreadsheet';
import Upload from '~icons/lucide/upload';
import Loader2 from '~icons/lucide/loader2';
import CheckCircle from '~icons/lucide/check-circle';
import AlertTriangle from '~icons/lucide/alert-triangle';
import X from '~icons/lucide/x';
	import { Button } from '$lib/components/ui/button';
	import { Progress } from '$lib/components/ui/progress';
	import type { UploadState } from '$lib/types';

	let {
		uploadState = $bindable(),
		onUpload,
		onReset
	}: {
		uploadState: UploadState;
		onUpload: (file: File) => void;
		onReset: () => void;
	} = $props();

	let fileInput: HTMLInputElement | undefined = $state(undefined);

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		const file = e.dataTransfer?.files[0];
		if (file) onUpload(file);
	}

	function handleFileChange(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (file) onUpload(file);
	}
</script>

{#if uploadState.status === 'idle'}
	<div
		role="button"
		tabindex="0"
		aria-label="Drag and drop your file here, or click to browse"
		class="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center transition-colors hover:border-primary/50"
		ondragover={handleDragOver}
		ondragenter={handleDragOver}
		ondrop={handleDrop}
		onclick={() => fileInput?.click()}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				fileInput?.click();
			}
		}}
	>
		<FileSpreadsheet class="mx-auto mb-4 h-12 w-12 text-gray-400" />
		<p class="mb-4 text-gray-600">Drag and drop your file here, or click to browse</p>
		<p class="mb-4 text-sm text-gray-500">
			Supported formats: .xlsx, .xls, .csv (Max 10MB)
		</p>

		<input
			bind:this={fileInput}
			type="file"
			accept=".xlsx,.xls,.csv"
			onchange={handleFileChange}
			class="hidden"
		/>

		<Button
			onclick={(e: MouseEvent) => {
				e.stopPropagation();
				fileInput?.click();
			}}
		>
			<Upload class="mr-2 h-4 w-4" />
			Choose File
		</Button>
	</div>
{:else if uploadState.status === 'uploading'}
	<div class="py-8 text-center">
		<Loader2 class="mx-auto mb-4 h-8 w-8 animate-spin text-blue-600" />
		<p class="mb-2 text-lg font-medium">Uploading file...</p>
		<p class="text-gray-600">{uploadState.fileName}</p>
		<Progress value={uploadState.uploadProgress} class="mx-auto mt-4 max-w-md" />
	</div>
{:else if uploadState.status === 'uploaded'}
	<div class="py-8 text-center">
		<CheckCircle class="mx-auto mb-4 h-8 w-8 text-green-600" />
		<p class="mb-2 text-lg font-medium">File uploaded successfully!</p>
		<p class="text-gray-600">{uploadState.fileName}</p>
		<p class="mb-4 text-sm text-gray-500">Generating preview...</p>
	</div>
{:else if uploadState.status === 'preview-loading'}
	<div class="py-8 text-center">
		<Loader2 class="mx-auto mb-4 h-8 w-8 animate-spin text-blue-600" />
		<p class="mb-2 text-lg font-medium">Generating preview...</p>
		<p class="mb-4 text-gray-600">{uploadState.fileName}</p>
		<Button
			onclick={onReset}
			variant="outline"
			size="sm"
		>
			<X class="mr-2 h-4 w-4" />
			Cancel / Start Over
		</Button>
	</div>
{:else if uploadState.status === 'error'}
	<div class="py-8 text-center">
		<AlertTriangle class="mx-auto mb-4 h-8 w-8 text-red-600" />
		<p class="mb-2 text-lg font-medium">Upload failed</p>
		<p class="mb-4 text-gray-600">{uploadState.error}</p>
		<Button onclick={onReset} class="mt-4">Try Again</Button>
	</div>
{/if}
