<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';

	let {
		class: className,
		ref = $bindable(null),
		children,
		...restProps
	}: HTMLAttributes<HTMLTableSectionElement> & { ref?: HTMLTableSectionElement | null } = $props();
</script>

<tfoot
	bind:this={ref}
	class={cn('border-t bg-muted/50 font-medium [&>tr]:last:border-b-0', className)}
	{...restProps}
>
	{@render children?.()}
</tfoot>
