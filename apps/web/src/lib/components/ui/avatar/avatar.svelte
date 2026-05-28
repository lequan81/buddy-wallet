<script lang="ts">
	import { Avatar as AvatarPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils';
	import type { ComponentProps } from 'svelte';

	let {
		class: className,
		ref = $bindable(null),
		...restProps
	}: ComponentProps<typeof AvatarPrimitive.Root> = $props();
</script>

<AvatarPrimitive.Root
	bind:ref
	class={cn('relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full', className)}
	{...restProps}
/>
