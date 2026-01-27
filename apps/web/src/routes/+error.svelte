<script lang="ts">
	import { page } from '$app/state';
	import ErrorPage from '$lib/components/shared/ErrorPage.svelte';
</script>

<ErrorPage
	status={page.status}
	message={page.error?.message}
	variant="full"
	showLogo={true}
	showFaq={true}
	showSupport={true}
/>
