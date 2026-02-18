<script lang="ts">
	import { useLanguage } from '$lib/hooks';
	// @ts-ignore
	import IconLucideChevronDown from '~icons/lucide/chevron-down';
	// @ts-ignore
	import IconLucideCheck from '~icons/lucide/check';
	import { onMount } from 'svelte';
	import { cn } from '$lib/utils';

	const lang = useLanguage();

	// Performance-optimized flag emoji mapping
	const FLAG_MAP: Record<string, string> = {
		en: 'ðŸ‡¬ðŸ‡§',
		vi: 'ðŸ‡»ðŸ‡³'
	};

	function getFlag(locale: string): string {
		return FLAG_MAP[locale] || 'ðŸŒ';
	}

	let detailsRef: HTMLDetailsElement | null = $state(null);

	async function handleSwitch(newLang: string) {
		await lang.set(newLang);
		if (detailsRef) detailsRef.open = false;
	}

	// Close dropdown when clicking outside
	onMount(() => {
		function handleClickOutside(event: MouseEvent) {
			if (detailsRef && !detailsRef.contains(event.target as Node)) {
				detailsRef.open = false;
			}
		}

		document.addEventListener('click', handleClickOutside);
		return () => document.removeEventListener('click', handleClickOutside);
	});
</script>

<details class="group relative" bind:this={detailsRef}>
	<summary
		class="inline-flex cursor-pointer list-none items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 [&::-webkit-details-marker]:hidden"
	>
		<span class="text-base leading-none">{getFlag(lang.current)}</span>
		<span class="capitalize">{lang.current}</span>
		<IconLucideChevronDown
			class="size-4 transition-transform duration-150 ease-in-out group-open:rotate-180"
		/>
	</summary>

	<div
		class="absolute top-full right-0 z-50 mt-1 min-w-36 rounded-md border border-border bg-popover p-1 shadow-md"
	>
		{#each lang.all as item}
			<button
				type="button"
				class={cn(
					'flex w-full cursor-pointer items-center justify-between rounded border-none bg-transparent px-3 py-2 text-left text-sm text-inherit transition-colors hover:bg-accent',
					item === lang.current && 'bg-accent/50 font-medium'
				)}
				onclick={() => handleSwitch(item)}
			>
				<span class="flex items-center gap-2">
					<span class="text-base leading-none">{getFlag(item)}</span>
					<span class="capitalize">{lang.getLabel(item)}</span>
				</span>

				{#if item === lang.current}
					<IconLucideCheck class="size-4" />
				{/if}
			</button>
		{/each}
	</div>
</details>
