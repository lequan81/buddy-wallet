<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';

	let {
		class: className,
		ref = $bindable(null),
		type = 'text',
		...restProps
	}: HTMLInputAttributes & { ref?: HTMLInputElement | null } = $props();
</script>

<input
	bind:this={ref}
	{type}
	class={cn(
		'border border-zinc-200 bg-white placeholder:text-zinc-400 focus-visible:border-zinc-300 focus-visible:outline-hidden dark:border-zinc-800 dark:bg-zinc-950 dark:placeholder:text-zinc-650 dark:focus-visible:border-zinc-700 flex h-10 w-full rounded-md px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:cursor-not-allowed disabled:opacity-50 transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.01)]',
		className
	)}
	{...restProps}
/>
