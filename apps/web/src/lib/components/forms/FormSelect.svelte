<script lang="ts">
	import { Label } from '@repo/ui/components/ui/label';
	import { cn } from '$lib/utils';

	import type { HTMLSelectAttributes } from 'svelte/elements';

	let {
		label,
		name,
		placeholder = 'Select an option',
		required = false,
		disabled = false,
		value = $bindable(''),
		error,
		success,
		warning,
		validationState = 'default',
		options = [],
		class: className,
		...restProps
	}: HTMLSelectAttributes & {
		label?: string;
		error?: string;
		success?: string;
		warning?: string;
		validationState?: 'default' | 'success' | 'error' | 'warning';
		options: Array<{ value: string; label: string }>;
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
		<select
			id={name}
			{name}
			{required}
			{disabled}
			bind:value
			class={cn(
				'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
				'file:border-0 file:bg-transparent file:text-sm file:font-medium',
				'placeholder:text-muted-foreground',
				'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none',
				'disabled:cursor-not-allowed disabled:opacity-50',
				stateConfig.ringClass,
				StateIcon ? 'pr-10' : '',
				className
			)}
			{...restProps}
		>
			<option value="" disabled>{placeholder}</option>
			{#each options as option}
				<option value={option.value}>{option.label}</option>
			{/each}
		</select>

		{#if StateIcon}
			<div class="pointer-events-none absolute top-2.5 right-3">
				<StateIcon class="h-4 w-4 {stateConfig.iconClass}" />
			</div>
		{/if}
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
