<script lang="ts">
	import { Loader2 } from '@lucide/svelte';
	import { cn } from '$lib/utils';

	let {
		size = 'default',
		class: className
	}: {
		size?: 'sm' | 'default' | 'lg';
		class?: string;
	} = $props();

	const sizeClasses = {
		sm: 'h-4 w-4',
		default: 'h-6 w-6',
		lg: 'h-8 w-8'
	};
</script>

<div class={cn('flex items-center justify-center', className)}>
	<Loader2 class={cn('animate-spin text-muted-foreground', sizeClasses[size])} />
</div>
