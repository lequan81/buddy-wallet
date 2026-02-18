<script lang="ts">
	import { Textarea } from '@repo/ui/components/ui/textarea';
	import { Label } from '@repo/ui/components/ui/label';
	import { cn } from '$lib/utils';

	import type { HTMLTextareaAttributes } from 'svelte/elements';

	let {
		label,
		name,
		placeholder,
		required = false,
		disabled = false,
		value = $bindable(''),
		error,
		success,
		warning,
		validationState = 'default',
		rows = 4,
		class: className,
		...restProps
	}: HTMLTextareaAttributes & {
		label?: string;
		error?: string;
		success?: string;
		warning?: string;
		validationState?: 'default' | 'success' | 'error' | 'warning';
	} = $props();

	const stateConfig = $derived.by(() => {
		const configs = {
			error: {
				icon: IconLucideAlertCircle,
				ringClass: 'ring-2 ring-destructive focus-visible:ring-destructive',
				textClass: 'text-destructive',
				iconClass: 'text-destructive',
				message: error
			},
			success: {
				icon: IconLucideCheckCircle2,
				ringClass: 'ring-2 ring-success focus-visible:ring-success',
				textClass: 'text-success',
				iconClass: 'text-success',
				message: success
			},
			warning: {
				icon: IconLucideAlertTriangle,
				ringClass: 'ring-2 ring-warning focus-visible:ring-warning',
				textClass: 'text-warning',
				iconClass: 'text-warning',
				message: warning
			},
			default: {
				icon: null,
				ringClass: '',
				textClass: '',
				iconClass: '',
				message: null
			}
		};
		return configs[validationState];
	});

	const StateIcon = $derived(stateConfig.icon);
</script>

<div class="space-y-2">
	{#if label}
		<Label for={name} class="text-sm font-medium">
			{label}{required ? ' *' : ''}
		</Label>
	{/if}

	<div class="relative">
		<Textarea
			id={name}
			{name}
			{placeholder}
			{required}
			{disabled}
			{rows}
			bind:value
			class={cn(stateConfig.ringClass, className)}
			{...restProps}
		/>
	</div>

	{#if stateConfig.message}
		<p class="text-sm {stateConfig.textClass} flex items-start gap-1.5">
			{#if StateIcon}
				<StateIcon class="mt-0.5 h-4 w-4 shrink-0" />
			{/if}
			<span>{stateConfig.message}</span>
		</p>
	{/if}
</div>
