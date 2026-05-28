<script lang="ts">
	import { Separator } from '$lib/components/ui/separator';
	import { cn } from '$lib/utils';
	import type { Snippet } from 'svelte';

	let {
		title,
		description,
		actions,
		class: className
	}: {
		title: string;
		description?: string;
		actions?: Snippet | null;
		class?: string;
	} = $props();
</script>

<div class={cn('space-y-4', className)}>
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div class="space-y-1">
			<h2 class="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
			{#if description}
				<p class="text-muted-foreground">{description}</p>
			{/if}
		</div>
		{#if actions}
			<div class="flex items-center gap-2">
				{@render actions()}
			</div>
		{/if}
	</div>
	<Separator />
</div>
