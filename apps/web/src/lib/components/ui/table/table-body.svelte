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

<tbody
	bind:this={ref}
	class={cn('[&_tr:last-child]:border-0', className)}
	{...restProps}
>
	{@render children?.()}
</tbody>
