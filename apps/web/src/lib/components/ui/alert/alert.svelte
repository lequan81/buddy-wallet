<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { cn } from '$lib/utils';
	import { alertVariants, type Variant } from './index';

	let {
		class: className,
		variant = 'default',
		ref = $bindable(null),
		children,
		...restProps
	}: HTMLAttributes<HTMLDivElement> & { variant?: Variant; ref?: HTMLDivElement | null } = $props();
</script>

<div
	bind:this={ref}
	class={cn(alertVariants({ variant }), className)}
	role="alert"
	{...restProps}
>
	{@render children?.()}
</div>
