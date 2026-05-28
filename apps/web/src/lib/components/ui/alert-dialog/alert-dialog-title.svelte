<script lang="ts">
	import { AlertDialog as AlertDialogPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils';
	import type { ComponentProps } from 'svelte';

	let {
		class: className,
		ref = $bindable(null),
		children,
		...restProps
	}: ComponentProps<typeof AlertDialogPrimitive.Title> = $props();
</script>

<AlertDialogPrimitive.Title
	bind:ref
	class={cn('text-lg font-semibold', className)}
	{...restProps}
>
	{@render children?.()}
</AlertDialogPrimitive.Title>
