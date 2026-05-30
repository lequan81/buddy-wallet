<script lang="ts">
	import Upload from '~icons/lucide/upload';
	import X from '~icons/lucide/x';
	import Loader2 from '~icons/lucide/loader2';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { toast } from 'svelte-sonner';
	import { invalidateAll } from '$app/navigation';
	import { uploadProof } from '$lib/remotes/proofs.remote';

	let isUploading = $state(false);
	let selectedFile = $state<File | null>(null);

	function onFileChange(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			selectedFile = target.files[0];
		}
	}

	function clearFile() {
		selectedFile = null;
		// Reset the file input so the same file can be re-selected
		const input = document.getElementById('proof-file-input') as HTMLInputElement | null;
		if (input) input.value = '';
	}
</script>

<Card.Root class="border-0 bg-white dark:bg-zinc-900 shadow-[0_4px_12px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.2)] rounded-lg">
	<Card.Header>
		<Card.Title class="text-sm font-medium">Upload Proof</Card.Title>
	</Card.Header>
	<Card.Content>
		<form
			{...uploadProof.enhance(async ({ submit }) => {
				isUploading = true;
				try {
					await submit();
					const result = uploadProof.result;
					if (result?.success) {
						toast.success('Proof uploaded successfully');
						clearFile();
						await invalidateAll();
					} else if (result?.message) {
						toast.error(result.message as string);
					}
				} catch {
					toast.error('Failed to upload proof');
				}
				isUploading = false;
			})}
			class="space-y-4"
		>
			<!-- Hidden native file input that lives inside the form with name="proof" -->
			<input
				id="proof-file-input"
				type="file"
				name="proof"
				class="hidden"
				accept="image/*"
				onchange={onFileChange}
			/>

			{#if !selectedFile}
				<div
					class="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/20 dark:bg-zinc-800/10 p-6 transition-colors hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 cursor-pointer"
					onclick={() => document.getElementById('proof-file-input')?.click()}
					onkeydown={(e) => e.key === 'Enter' && document.getElementById('proof-file-input')?.click()}
					role="button"
					tabindex="0"
				>
					<Upload class="mb-2 h-8 w-8 text-muted-foreground" />
					<p class="text-xs font-medium">Click to upload payment proof</p>
					<p class="text-[10px] text-muted-foreground mt-1">PNG, JPG up to 10MB</p>
				</div>
			{:else}
				<div class="flex items-center justify-between rounded-lg border border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/30 dark:bg-zinc-800/20 p-3">
					<div class="flex items-center gap-3 overflow-hidden">
						<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-primary/10">
							<Upload class="h-5 w-5 text-primary" />
						</div>
						<div class="overflow-hidden">
							<p class="text-xs font-medium truncate">{selectedFile.name}</p>
							<p class="text-[10px] text-muted-foreground">
								{(selectedFile.size / 1024).toFixed(1)} KB
							</p>
						</div>
					</div>
					<div class="flex items-center gap-1">
						<Button variant="ghost" size="icon" class="h-8 w-8" type="button" onclick={clearFile}>
							<X class="h-4 w-4" />
						</Button>
						<Button type="submit" size="sm" disabled={isUploading}>
							{#if isUploading}
								<Loader2 class="mr-2 h-3 w-3 animate-spin" />
								Uploading
							{:else}
								Upload
							{/if}
						</Button>
					</div>
				</div>
			{/if}
		</form>
	</Card.Content>
</Card.Root>

