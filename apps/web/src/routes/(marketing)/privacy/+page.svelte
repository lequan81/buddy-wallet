<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{data.metadata?.title || 'Privacy'} | Buddy Wallet</title>
</svelte:head>

<article class="prose prose-slate dark:prose-invert mx-auto max-w-3xl py-12 px-4">
	<data.component />
</article>
