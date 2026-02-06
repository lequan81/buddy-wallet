<script lang="ts">
	import { Button, type ButtonProps } from "@repo/ui/components/ui/button";

	let { ref = $bindable(null), ...restProps }: ButtonProps = $props();
</script>

<Button bind:ref type="submit" {...restProps} />
