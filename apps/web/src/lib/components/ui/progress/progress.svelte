<script lang="ts">
	import { Progress as ProgressPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils';
	import type { ComponentProps } from 'svelte';

	let {
		class: className,
		value = 0,
		max = 100,
		ref = $bindable(null),
		...restProps
	}: ComponentProps<typeof ProgressPrimitive.Root> = $props();

	let percentage = $derived(value != null ? (value / max) * 100 : 0);
</script>

<ProgressPrimitive.Root
	bind:ref
	class={cn('bg-secondary relative h-4 w-full overflow-hidden rounded-full', className)}
	{value}
	{max}
	{...restProps}
>
	<div
		class="bg-primary h-full w-full flex-1 transition-all duration-300"
		style="transform: translateX(-{100 - percentage}%)"
	></div>
</ProgressPrimitive.Root>
