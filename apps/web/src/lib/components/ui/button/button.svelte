<script lang="ts">
	import { cn } from '$lib/utils';
	import { buttonVariants, type Props } from './index';

	let {
		class: className,
		variant = 'default',
		size = 'default',
		ref = $bindable(null),
		children,
		type = 'button',
		...restProps
	}: Props = $props();
</script>

<button
	bind:this={ref}
	{type}
	class={cn(buttonVariants({ variant, size }), className)}
	{...restProps}
>
	{@render children?.()}
</button>
