<script lang="ts">
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils';
	import type { ComponentProps } from 'svelte';

	let {
		class: className,
		ref = $bindable(null),
		children,
		portalProps,
		...restProps
	}: ComponentProps<typeof DialogPrimitive.Content> & {
		portalProps?: ComponentProps<typeof DialogPrimitive.Portal>;
	} = $props();
</script>

<DialogPrimitive.Portal {...portalProps} to="body">
	<DialogPrimitive.Overlay
		class="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/80"
	/>
	<DialogPrimitive.Content
		bind:ref
		class={cn(
			'bg-background border-t fixed inset-x-0 bottom-0 z-50 grid w-full gap-4 p-6 shadow-lg transition duration-200 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom rounded-t-xl',
			className
		)}
		{...restProps}
	>
		<div class="bg-muted mx-auto h-1.5 w-[40px] rounded-full"></div>
		{@render children?.()}
	</DialogPrimitive.Content>
</DialogPrimitive.Portal>
