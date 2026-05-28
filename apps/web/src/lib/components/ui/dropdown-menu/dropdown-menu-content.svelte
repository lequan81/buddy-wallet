<script lang="ts">
	import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils';
	import type { ComponentProps } from 'svelte';

	let {
		class: className,
		ref = $bindable(null),
		children,
		portalProps,
		...restProps
	}: ComponentProps<typeof DropdownMenuPrimitive.Content> & {
		portalProps?: ComponentProps<typeof DropdownMenuPrimitive.Portal>;
	} = $props();
</script>

<DropdownMenuPrimitive.Portal {...portalProps} to="body">
	<DropdownMenuPrimitive.Content
		bind:ref
		class={cn(
			'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 relative z-50 min-w-[8rem] overflow-hidden rounded-md border p-1 shadow-md',
			className
		)}
		{...restProps}
	>
		{@render children?.()}
	</DropdownMenuPrimitive.Content>
</DropdownMenuPrimitive.Portal>
