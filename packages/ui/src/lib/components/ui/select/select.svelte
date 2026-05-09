<script lang="ts">
	import { Select as SelectPrimitive } from "bits-ui";
	import type { SelectSingleRootProps } from "bits-ui";

	let {
		value = $bindable(undefined),
		open = $bindable(false),
		...restProps
	}: Omit<SelectSingleRootProps, "type"> = $props();
</script>

<SelectPrimitive.Root bind:value bind:open type="single" {...restProps} />
