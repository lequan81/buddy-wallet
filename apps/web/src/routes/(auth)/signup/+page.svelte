<script lang="ts">
	import { resolve } from '$app/paths';
	import { Check, Circle, Loader2 } from '@repo/icons';
	import { toast } from 'svelte-sonner';
	import { superForm } from 'sveltekit-superforms';
	import { Button } from '@repo/ui/components/ui/button';
	import * as Card from '@repo/ui/components/ui/card';
	import FormInput from '$lib/components/forms/FormInput.svelte';

	import type { Infer } from 'sveltekit-superforms';
	import type { PageData } from './$types';
	import { signupSchema } from '@repo/validation/client';

	const { data }: { data: PageData } = $props();

	// superForm expects the form data directly, not a getter
	// svelte-ignore state_referenced_locally
	const { form, errors, constraints, message, enhance, delayed } = superForm<
		Infer<typeof signupSchema>
	>(data.form, {
		onResult: ({ result }) => {
			if (result.type === 'failure') {
				toast.error('Please check your input');
			}
		}
	});

	// Password validation rules (Visual feedback only, schema handles actual validation)
	const passwordRules = $derived([
		{ label: 'At least 8 characters', valid: ($form.password?.length ?? 0) >= 8 },
		{ label: 'One uppercase letter', valid: /[A-Z]/.test($form.password ?? '') },
		{ label: 'One lowercase letter', valid: /[a-z]/.test($form.password ?? '') },
		{ label: 'One number', valid: /\d/.test($form.password ?? '') },
		{ label: 'One special character', valid: /[!@#$%^&*(),.?":{}|<>]/.test($form.password ?? '') }
	]);

	// Repeat password state
	let confirmPassword = $state('');
	let confirmPasswordState = $derived.by(() => {
		if (confirmPassword === '') return 'default' as const;
		if (confirmPassword !== ($form.password ?? '')) return 'error' as const;
		return 'success' as const;
	});
	let confirmPasswordMessage = $derived.by(() => {
		if (confirmPassword === '') return '';
		if (confirmPassword !== ($form.password ?? '')) return 'Passwords do not match';
		return 'Passwords match';
	});

	// Determine validation states
	const nameState = $derived($errors.name ? 'error' : $form.name ? 'success' : 'default');
	const phoneState = $derived(
		$errors.phoneNumber
			? 'error'
			: $form.phoneNumber && $form.phoneNumber.length >= 10
				? 'success'
				: 'default'
	);
	const emailState = $derived(
		$errors.email ? 'error' : $form.email && $form.email.includes('@') ? 'success' : 'default'
	);
	const passwordState = $derived(
		$errors.password ? 'error' : passwordRules.every((r) => r.valid) ? 'success' : 'default'
	);
	const canSubmit = $derived(
		passwordRules.every((r) => r.valid) &&
			(confirmPassword === '' || confirmPassword === ($form.password ?? '')) &&
			!$delayed
	);

	// Show toast on form error message if server returns specific message
	$effect(() => {
		if ($message) {
			toast.error($message);
		}
	});
</script>

<div class="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
	<Card.Root class="w-full max-w-md">
		<Card.Header class="space-y-1 text-center">
			<Card.Title class="text-2xl font-bold">Create an account</Card.Title>
			<Card.Description>Enter your information to get started</Card.Description>
		</Card.Header>

		<Card.Content>
			<form method="POST" use:enhance class="space-y-4">
				<!-- Name Field -->
				<FormInput
					label="Full Name"
					name="name"
					type="text"
					placeholder="Nguyá»…n VÄƒn A"
					bind:value={$form.name}
					validationState={nameState}
					error={$errors.name?.[0]}
					success={nameState === 'success' ? 'Name looks good' : undefined}
					required
					{...$constraints.name}
				/>

				<!-- Phone Number Field (Required) -->
				<div class="space-y-2">
					<FormInput
						label="Phone Number"
						name="phoneNumber"
						type="tel"
						placeholder="0901234567"
						bind:value={$form.phoneNumber}
						validationState={phoneState}
						error={$errors.phoneNumber?.[0]}
						success={phoneState === 'success' ? 'Phone number is valid' : undefined}
						required
						{...$constraints.phoneNumber}
					/>
					{#if !$errors.phoneNumber}
						<p class="text-xs text-muted-foreground">Used to link debts to your account</p>
					{/if}
				</div>

				<!-- Email Field (Optional) -->
				<FormInput
					label="Email (Optional)"
					name="email"
					type="email"
					placeholder="name@example.com"
					bind:value={$form.email}
					validationState={emailState}
					error={$errors.email?.[0]}
					success={emailState === 'success' ? 'Email looks good' : undefined}
					{...$constraints.email}
				/>

				<!-- Password Field -->
				<div class="space-y-2">
					<FormInput
						label="Password"
						name="password"
						type="password"
						placeholder="Create a strong password"
						bind:value={$form.password}
						validationState={passwordState}
						error={$errors.password?.[0]}
						success={passwordState === 'success' ? 'Strong password' : undefined}
						showPasswordToggle={true}
						required
						minlength={$constraints.password?.minlength}
						maxlength={$constraints.password?.maxlength}
					/>

					<!-- Password Requirements - Always visible, no layout shift -->
					<div class="grid grid-cols-2 gap-x-4 gap-y-1 pt-1">
						{#each passwordRules as rule}
							<div class="flex items-center gap-1.5 text-xs">
								{#if rule.valid}
									<Check class="h-3 w-3 shrink-0 text-success" />
									<span class="text-success">{rule.label}</span>
								{:else}
									<Circle class="h-3 w-3 shrink-0 text-muted-foreground/50" />
									<span class="text-muted-foreground">{rule.label}</span>
								{/if}
							</div>
						{/each}
					</div>
				</div>

				<!-- Confirm Password Field -->
				<FormInput
					label="Confirm Password"
					name="confirmPassword"
					type="password"
					placeholder="Re-enter your password"
					bind:value={confirmPassword}
					validationState={confirmPasswordState}
					error={confirmPasswordState === 'error' ? confirmPasswordMessage : undefined}
					success={confirmPasswordState === 'success' ? confirmPasswordMessage : undefined}
					showPasswordToggle={true}
					required
				/>

				<!-- Submit Button - Fixed height -->
				<Button type="submit" class="h-10 w-full" disabled={!canSubmit}>
					<span class="inline-flex items-center justify-center">
						{#if $delayed}
							<Loader2 class="mr-2 h-4 w-4 animate-spin" />
							Creating account...
						{:else}
							Create account
						{/if}
					</span>
				</Button>
			</form>
		</Card.Content>

		<Card.Footer class="flex flex-col space-y-4">
			<div class="relative w-full">
				<div class="absolute inset-0 flex items-center">
					<span class="w-full border-t"></span>
				</div>
				<div class="relative flex justify-center text-xs uppercase">
					<span class="bg-card px-2 text-muted-foreground"> Already have an account? </span>
				</div>
			</div>
			<Button
				variant="outline"
				class="h-10 w-full"
				href={resolve(`/login`, {})}
				data-sveltekit-preload-data="hover">Sign in</Button
			>
		</Card.Footer>
	</Card.Root>
</div>
