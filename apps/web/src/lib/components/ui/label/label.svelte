<script lang="ts">
	import { Label as LabelPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils';
	import type { ComponentProps } from 'svelte';

	let {
		class: className,
		ref = $bindable(null),
		children,
		...restProps
	}: ComponentProps<typeof LabelPrimitive> = $props();
</script>

<LabelPrimitive
	bind:ref
	class={cn(
		'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 select-none',
		className
	)}
	{...restProps}
>
	{@render children?.()}
</LabelPrimitive>
