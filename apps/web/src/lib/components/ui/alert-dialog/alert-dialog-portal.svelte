<script lang="ts">
	import { AlertDialog as AlertDialogPrimitive } from 'bits-ui';
	import type { ComponentProps } from 'svelte';

	let { ...restProps }: ComponentProps<typeof AlertDialogPrimitive.Portal> = $props();
</script>

<AlertDialogPrimitive.Portal {...restProps} to="body" />
