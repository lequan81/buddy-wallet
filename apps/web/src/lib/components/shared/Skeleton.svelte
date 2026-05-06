<script lang="ts">
	import { cn } from '$lib/utils';

	let {
		class: className,
		...props
	}: {
		class?: string;
		[key: string]: unknown;
	} = $props();
</script>

<div class={cn('animate-pulse rounded-md bg-muted', className)} {...props}></div>
