<script lang="ts" generics="T extends Record<string, unknown>, U extends FormPath<T>">
	import * as Form from '@repo/ui/components/ui/form';
	import { Input } from '@repo/ui/components/ui/input';
	import { cn } from '$lib/utils';
	import { AlertCircle, Eye, EyeOff } from '@repo/icons';
	import type { FormPath } from 'sveltekit-superforms';
	import type { HTMLInputAttributes } from 'svelte/elements';
	import type { Component } from 'svelte';
	import type { SuperForm } from 'sveltekit-superforms';

	let {
		form,
		name,
		label,
		type = 'text',
		placeholder,
		required = false,
		disabled = false,
		showPasswordToggle = false,
		icon,
		helpText,
		class: className,
		...restProps
	}: Omit<HTMLInputAttributes, 'type'> & {
		form: SuperForm<T>;
		name: U;
		label?: string;
		type?: HTMLInputAttributes['type'];
		showPasswordToggle?: boolean;
		icon?: Component;
		helpText?: string;
	} = $props();

	let showPassword = $state(false);
	let inputType = $derived(showPasswordToggle && showPassword ? 'text' : (type ?? 'text'));
	let inputProps = $derived.by(() => restProps as Record<string, unknown>);

	function handleInput(e: Event) {
		const target = e.currentTarget as HTMLInputElement;
		const newValue = type === 'number' ? Number(target.value) : target.value;
		form.form.update(($form) => {
			($form as Record<string, unknown>)[name as string] = newValue;
			return $form;
		});
	}

	/** Extract the id from formsnap control props for accessibility binding */
	function getControlId(props: Record<string, unknown>): string | undefined {
		return typeof props.id === 'string' ? props.id : undefined;
	}
</script>

<Form.Field {form} {name}>
	{#snippet children({ errors, value }: { errors: string[]; value: unknown })}
		{@const hasError = errors && errors.length > 0}

		<Form.Control>
			{#snippet children({ props })}
				{#if label}
					<Form.Label class="text-sm font-medium">
						{label}{required ? ' *' : ''}
					</Form.Label>
				{/if}

				<div class="relative">
					{#if icon}
						{@const IconComponent = icon}
						<div class="pointer-events-none absolute top-2.5 left-3">
							<IconComponent class="h-4 w-4 text-muted-foreground" />
						</div>
					{/if}

					<Input
							id={getControlId(props)}
							type={inputType}
						{placeholder}
						{required}
						{disabled}
						value={String(value ?? '')}
						oninput={handleInput}
						class={cn(
							hasError ? 'ring-2 ring-destructive focus-visible:ring-destructive' : '',
							icon ? 'pl-10' : '',
							hasError || showPasswordToggle ? 'pr-10' : '',
							className
						)}
						aria-invalid={hasError}
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
					{:else if hasError}
						<div class="pointer-events-none absolute top-2.5 right-3">
							<AlertCircle class="h-4 w-4 text-destructive" />
						</div>
					{/if}
				</div>
			{/snippet}
		</Form.Control>

		{#if hasError}
			<Form.FieldErrors class="flex items-start gap-1.5 text-sm" />
		{/if}

		{#if helpText}
			<Form.Description>{helpText}</Form.Description>
		{/if}
	{/snippet}
</Form.Field>
