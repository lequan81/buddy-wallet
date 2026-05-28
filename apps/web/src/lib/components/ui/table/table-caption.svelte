<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';

	let {
		class: className,
		ref = $bindable(null),
		children,
		...restProps
	}: HTMLAttributes<HTMLTableCaptionElement> & { ref?: HTMLTableCaptionElement | null } = $props();
</script>

<caption
	bind:this={ref}
	class={cn('mt-4 text-sm text-muted-foreground', className)}
	{...restProps}
>
	{@render children?.()}
</caption>
