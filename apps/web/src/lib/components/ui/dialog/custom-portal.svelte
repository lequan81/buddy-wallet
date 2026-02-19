<script lang="ts">
	import { Dialog as DialogPrimitive } from 'bits-ui';
	import type { ComponentProps } from 'svelte';

	// We need to ensure the portal mounts to body to avoid z-index and overflow issues
	// in complicated layouts. bits-ui's Portal usually does this, but sometimes
	// it needs explicit 'to' prop or just a clean wrapper.

	let { ...restProps }: ComponentProps<typeof DialogPrimitive.Portal> = $props();
</script>

<DialogPrimitive.Portal {...restProps} to="body" />
