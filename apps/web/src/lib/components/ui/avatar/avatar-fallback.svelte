<script lang="ts">
	import { Avatar as AvatarPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils';
	import type { ComponentProps } from 'svelte';

	let {
		class: className,
		ref = $bindable(null),
		children,
		...restProps
	}: ComponentProps<typeof AvatarPrimitive.Fallback> = $props();
</script>

<AvatarPrimitive.Fallback
	bind:ref
	class={cn(
		'bg-muted text-muted-foreground flex h-full w-full items-center justify-center rounded-full text-sm font-medium uppercase',
		className
	)}
	{...restProps}
>
	{@render children?.()}
</AvatarPrimitive.Fallback>
