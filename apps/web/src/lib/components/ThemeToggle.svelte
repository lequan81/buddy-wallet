<script lang="ts">
	import { Button } from '@repo/ui/components/ui/button';
	import { Moon, Sun } from '@lucide/svelte';
	import { useTheme } from '$lib/hooks';
	import { cn } from '$lib/utils';

	let { class: className }: { class?: string } = $props();
	const theme = useTheme();
</script>

<Button
	variant="ghost"
	size="icon-sm"
	class={cn(
		"group rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200",
		"dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700",
		className
	)}
	onclick={theme.toggle}
	title="Toggle theme"
>
	{#if theme.current === 'light'}
		<Sun
			class="block size-4.5 transition-transform duration-500 ease-in-out group-hover:rotate-360 dark:hidden"
		/>
	{:else}
		<Moon
			class="hidden size-4.5 transition-transform duration-500 ease-in-out group-hover:rotate-360 dark:block"
		/>
	{/if}
	<span class="sr-only">Toggle theme</span>
</Button>
