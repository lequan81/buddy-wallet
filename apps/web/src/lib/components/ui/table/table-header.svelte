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

<thead
	bind:this={ref}
	class={cn('[&_tr]:border-b', className)}
	{...restProps}
>
	{@render children?.()}
</thead>
