<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{data.metadata?.title || 'Privacy'} | Buddy Wallet</title>
</svelte:head>

<article class="mx-auto prose max-w-3xl px-4 py-12 prose-slate dark:prose-invert">
	<data.component />
</article>
