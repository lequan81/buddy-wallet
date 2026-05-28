<script lang="ts">
	import AlertCircle from '~icons/lucide/alert-circle';
import AlertTriangle from '~icons/lucide/alert-triangle';
import CheckCircle2 from '~icons/lucide/check-circle-2';
import Eye from '~icons/lucide/eye';
import EyeOff from '~icons/lucide/eye-off';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { cn } from '$lib/utils';
	import type { HTMLInputAttributes } from 'svelte/elements';
	import type { Component } from 'svelte';

	let {
		label,
		name,
		type = 'text',
		placeholder,
		required = false,
		disabled = false,
		value = $bindable(),
		error,
		success,
		warning,
		validationState = 'default',
		showPasswordToggle = false,
		icon,
		helpText,
		class: className,
		...restProps
	}: HTMLInputAttributes & {
		label?: string;
		error?: string;
		success?: string;
		warning?: string;
		validationState?: 'default' | 'success' | 'error' | 'warning';
		showPasswordToggle?: boolean;
		icon?: Component;
		helpText?: string;
	} = $props();

	let showPassword = $state(false);
	let inputType = $derived(showPasswordToggle && showPassword ? 'text' : (type ?? 'text'));

	let inputProps = $derived.by(() => restProps as Record<string, unknown>);

	const stateConfig = $derived.by(() => {
		const configs = {
			error: {
				icon: AlertCircle,
				ringClass: 'ring-2 ring-destructive focus-visible:ring-destructive',
				textClass: 'text-destructive',
				iconClass: 'text-destructive',
				message: error
			},
			success: {
				icon: CheckCircle2,
				ringClass: 'ring-2 ring-success focus-visible:ring-success',
				textClass: 'text-success',
				iconClass: 'text-success',
				message: success
			},
			warning: {
				icon: AlertTriangle,
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
		{#if icon}
			{@const IconComponent = icon}
			<div class="pointer-events-none absolute top-2.5 left-3">
				<IconComponent class="h-4 w-4 text-muted-foreground" />
			</div>
		{/if}

		<Input
			id={name}
			{name}
			type={inputType}
			{placeholder}
			{required}
			{disabled}
			bind:value
			class={cn(
				stateConfig.ringClass,
				icon ? 'pl-10' : '',
				StateIcon || showPasswordToggle ? 'pr-10' : '',
				className
			)}
			{...inputProps}
		/>

		{#if showPasswordToggle}
			<button
				type="button"
				onclick={() => (showPassword = !showPassword)}
				class="absolute top-2.5 right-3 text-muted-foreground transition-colors hover:text-foreground"
				aria-label={showPassword ? 'Hide password' : 'Show password'}
				tabindex="-1"
			>
				{#if showPassword}
					<EyeOff class="h-4 w-4" />
				{:else}
					<Eye class="h-4 w-4" />
				{/if}
			</button>
		{:else if StateIcon}
			<div class="pointer-events-none absolute top-2.5 right-3">
				<StateIcon class={cn('h-4 w-4', stateConfig.iconClass)} />
			</div>
		{/if}
	</div>

	{#if stateConfig.message}
		<p class={cn('flex items-start gap-1.5 text-sm', stateConfig.textClass)}>
			{#if StateIcon}
				<StateIcon class="mt-0.5 h-4 w-4 shrink-0" />
			{/if}
			<span>{stateConfig.message}</span>
		</p>
	{/if}

	{#if helpText}
		<p class="text-sm text-muted-foreground">{helpText}</p>
	{/if}
</div>
