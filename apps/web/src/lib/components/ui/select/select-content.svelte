<script lang="ts">
	import { Select as SelectPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils';
	import type { ComponentProps } from 'svelte';

	let {
		class: className,
		ref = $bindable(null),
		children,
		portalProps,
		...restProps
	}: ComponentProps<typeof SelectPrimitive.Content> & {
		portalProps?: ComponentProps<typeof SelectPrimitive.Portal>;
	} = $props();
</script>

<SelectPrimitive.Portal {...portalProps} to="body">
	<SelectPrimitive.Content
		bind:ref
		class={cn(
			'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border shadow-md',
			className
		)}
		{...restProps}
	>
		<div class="p-1">
			{@render children?.()}
		</div>
	</SelectPrimitive.Content>
</SelectPrimitive.Portal>
