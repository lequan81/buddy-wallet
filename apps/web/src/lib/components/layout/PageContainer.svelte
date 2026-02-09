<script lang="ts">
	import { cn } from '$lib/utils';

	let {
		class: className,
		maxWidth = 'max-w-7xl',
		children
	}: {
		class?: string;
		maxWidth?: string;
		children?: any;
	} = $props();
</script>

<div class={cn('mx-auto w-full px-4 sm:px-6 lg:px-8', maxWidth, className)}>
	{@render children?.()}
</div>
