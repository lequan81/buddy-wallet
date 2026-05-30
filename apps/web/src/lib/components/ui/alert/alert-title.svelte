<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';

	let {
		class: className,
		ref = $bindable(null),
		children,
		tag: Tag = 'h5',
		...restProps
	}: HTMLAttributes<HTMLHeadingElement> & { ref?: HTMLHeadingElement | null; tag?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' } = $props();
</script>

<svelte:element
	this={Tag}
	bind:this={ref}
	class={cn('mb-1 font-medium leading-none tracking-tight', className)}
	{...restProps}
>
	{@render children?.()}
</svelte:element>
