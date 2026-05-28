<script lang="ts">
	import { Select as SelectPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils';
	import Check from '~icons/lucide/check';
	import type { ComponentProps } from 'svelte';

	let {
		class: className,
		ref = $bindable(null),
		children,
		...restProps
	}: ComponentProps<typeof SelectPrimitive.Item> = $props();
</script>

<SelectPrimitive.Item
	bind:ref
	class={cn(
		'focus:bg-accent focus:text-accent-foreground relative flex w-full cursor-default select-none items-center rounded-xs py-1.5 pr-2 pl-8 text-sm outline-hidden data-disabled:pointer-events-none data-disabled:opacity-50',
		className
	)}
	{...restProps}
>
	<span class="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
		<SelectPrimitive.ItemIndicator>
			<Check class="h-4 w-4" />
		</SelectPrimitive.ItemIndicator>
	</span>
	{@render children?.()}
</SelectPrimitive.Item>
