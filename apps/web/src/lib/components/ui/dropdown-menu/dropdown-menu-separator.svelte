<script lang="ts">
	import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils';
	import type { ComponentProps } from 'svelte';

	let {
		class: className,
		ref = $bindable(null),
		...restProps
	}: ComponentProps<typeof DropdownMenuPrimitive.Separator> = $props();
</script>

<DropdownMenuPrimitive.Separator
	bind:ref
	class={cn('-mx-1 my-1 h-px bg-muted', className)}
	{...restProps}
/>
