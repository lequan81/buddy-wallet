<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils';

	let {
		icon,
		title,
		description,
		action,
		class: className
	}: {
		icon?: Snippet;
		title: string;
		description?: string;
		action?: Snippet;
		class?: string;
	} = $props();
</script>

<div class={cn('flex flex-col items-center justify-center py-12 text-center', className)}>
	{#if icon}
		<div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
			{@render icon()}
		</div>
	{/if}

	<h3 class="mb-2 text-lg font-semibold">{title}</h3>

	{#if description}
		<p class="mb-6 max-w-sm text-sm text-muted-foreground">{description}</p>
	{/if}

	{#if action}
		<div>
			{@render action()}
		</div>
	{/if}
</div>
