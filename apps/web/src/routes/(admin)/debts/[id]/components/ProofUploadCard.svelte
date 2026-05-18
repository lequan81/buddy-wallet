<script lang="ts">
	import { Upload, X, Loader2 } from '@repo/icons';
	import * as Card from '@repo/ui/components/ui/card';
	import { Button } from '@repo/ui/components/ui/button';
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import { invalidateAll } from '$app/navigation';
	import type { DebtDetails } from '@repo/types/shared/debt';

	let { debt } = $props<{ debt: DebtDetails }>();

	let isUploading = $state(false);
	let fileInput = $state<HTMLInputElement>();
	let selectedFile = $state<File | null>(null);

	function onFileChange(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			selectedFile = target.files[0];
		}
	}
</script>

<Card.Root>
	<Card.Header>
		<Card.Title class="text-sm font-medium">Upload Proof</Card.Title>
	</Card.Header>
	<Card.Content>
		<div class="space-y-4">
			{#if !selectedFile}
				<div 
					class="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors hover:border-primary/50 cursor-pointer"
					onclick={() => fileInput?.click()}
					onkeydown={(e) => e.key === 'Enter' && fileInput?.click()}
					role="button"
					tabindex="0"
				>
					<Upload class="mb-2 h-8 w-8 text-muted-foreground" />
					<p class="text-xs font-medium">Click to upload payment proof</p>
					<p class="text-[10px] text-muted-foreground mt-1">PNG, JPG up to 10MB</p>
					<input 
						type="file" 
						class="hidden" 
						accept="image/*" 
						onchange={onFileChange}
						bind:this={fileInput}
					/>
				</div>
			{:else}
				<form
					method="POST"
					action="?/uploadProof"
					enctype="multipart/form-data"
					use:enhance={({ formData }) => {
						if (selectedFile) formData.append('file', selectedFile);
						isUploading = true;
						return async ({ result }) => {
							isUploading = false;
							if (result.type === 'success') {
								toast.success('Proof uploaded successfully');
								selectedFile = null;
								await invalidateAll();
							} else {
								toast.error('Failed to upload proof');
							}
						};
					}}
					class="flex items-center justify-between rounded-lg border p-3 bg-muted/30"
				>
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
						<Button variant="ghost" size="icon" class="h-8 w-8" type="button" onclick={() => selectedFile = null}>
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
				</form>
			{/if}
		</div>
	</Card.Content>
</Card.Root>
