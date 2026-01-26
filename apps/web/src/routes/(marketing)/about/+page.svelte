<script lang="ts">
	let { data } = $props();
	let Content = $derived(data.component);
</script>

<div class="prose dark:prose-invert mx-auto py-12 px-4">
	<Content />
</div>
