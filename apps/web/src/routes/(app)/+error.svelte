<script lang="ts">
	import { page } from '$app/state';
	import ErrorPage from '$lib/components/shared/ErrorPage.svelte';
</script>

<ErrorPage
	status={page.status}
	message={page.error?.message}
	variant="card"
	showLogo={false}
	homeLink="/"
	homeLabel="Go Home"
/>
