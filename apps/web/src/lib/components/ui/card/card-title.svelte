<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';

	let {
		class: className,
		ref = $bindable(null),
		children,
		tag: Tag = 'h3',
		...restProps
	}: HTMLAttributes<HTMLHeadingElement> & { ref?: HTMLHeadingElement | null; tag?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' } = $props();
</script>

<Tag
	bind:this={ref}
	class={cn('font-semibold leading-none tracking-tight', className)}
	{...restProps}
>
	{@render children?.()}
</Tag>
