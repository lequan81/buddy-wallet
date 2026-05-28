<script lang="ts">
	import { Separator as SeparatorPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils';
	import type { ComponentProps } from 'svelte';

	let {
		class: className,
		orientation = 'horizontal',
		decorative = true,
		ref = $bindable(null),
		...restProps
	}: ComponentProps<typeof SeparatorPrimitive> = $props();
</script>

<SeparatorPrimitive
	bind:ref
	{orientation}
	{decorative}
	class={cn(
		'bg-border shrink-0',
		orientation === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]',
		className
	)}
	{...restProps}
/>
