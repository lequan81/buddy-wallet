<script lang="ts">
	import { Badge } from '@repo/ui/components/ui/badge';
	import { cn } from '$lib/utils';
	import type { HTMLAttributes } from 'svelte/elements';

	let {
		status,
		class: className,
		...restProps
	}: HTMLAttributes<HTMLSpanElement> & { status: string } = $props();

	const styles: Record<string, string> = {
		pending:
			'border-amber-500/30 text-amber-700 bg-amber-500/10 dark:bg-amber-500/10 dark:text-amber-400',
		pending_confirmation:
			'border-amber-500/30 text-amber-700 bg-amber-500/10 dark:bg-amber-500/10 dark:text-amber-400',
		confirmed: 'border-blue-500/30 text-blue-700 bg-blue-500/10 dark:bg-blue-500/10 dark:text-blue-400',
		active: 'border-blue-500/30 text-blue-700 bg-blue-500/10 dark:bg-blue-500/10 dark:text-blue-400',
		paid: 'border-emerald-500/30 text-emerald-700 bg-emerald-500/10 dark:bg-emerald-500/10 dark:text-emerald-400',
		completed:
			'border-emerald-500/30 text-emerald-700 bg-emerald-500/10 dark:bg-emerald-500/10 dark:text-emerald-400',
		disputed: 'border-rose-500/30 text-rose-700 bg-rose-500/10 dark:bg-rose-500/10 dark:text-rose-400',
		overdue: 'border-rose-500/30 text-rose-700 bg-rose-500/10 dark:bg-rose-500/10 dark:text-rose-400',
		cancelled: 'border-muted-foreground/30 text-muted-foreground bg-muted/50 dark:bg-muted/20 dark:text-muted-foreground',
		rejected: 'border-muted-foreground/30 text-muted-foreground bg-muted/50 dark:bg-muted/20 dark:text-muted-foreground'
	};
</script>

<Badge
	variant="outline"
	class={cn(
		'capitalize',
		styles[status?.toLowerCase()] ?? 'border-gray-300 text-gray-500',
		className
	)}
	{...restProps}
>
	{status}
</Badge>
