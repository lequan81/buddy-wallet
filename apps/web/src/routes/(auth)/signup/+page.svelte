<script lang="ts">
	import { resolve } from '$app/paths';
	import { Check, Circle, Loader2 } from '@repo/icons';
	import { toast } from 'svelte-sonner';
	import { Button } from '@repo/ui/components/ui/button';
	import * as Card from '@repo/ui/components/ui/card';
	import FormInput from '$lib/components/forms/FormInput.svelte';

	import { registerRemote } from '$lib/remotes/auth.remote';

	let name = $state('');
	let phoneNumber = $state('');
	let email = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let isSubmitting = $state(false);

	// Password validation rules
	const passwordRules = $derived([
		{ label: 'At least 8 characters', valid: password.length >= 8 },
		{ label: 'One uppercase letter', valid: /[A-Z]/.test(password) },
		{ label: 'One lowercase letter', valid: /[a-z]/.test(password) },
		{ label: 'One number', valid: /\d/.test(password) },
		{ label: 'One special character', valid: /[!@#$%^&*(),.?":{}|<>]/.test(password) }
	]);

	// Confirm password state
	let confirmPasswordState = $derived.by(() => {
		if (confirmPassword === '') return 'default' as const;
		if (confirmPassword !== password) return 'error' as const;
		return 'success' as const;
	});
	let confirmPasswordMessage = $derived.by(() => {
		if (confirmPassword === '') return '';
		if (confirmPassword !== password) return 'Passwords do not match';
		return 'Passwords match';
	});

	// Determine validation states
	const nameState = $derived(name ? 'success' : 'default');
	const phoneState = $derived(
		phoneNumber && phoneNumber.length >= 10 ? 'success' : 'default'
	);
	const emailState = $derived(
		email && email.includes('@') ? 'success' : 'default'
	);
	const passwordState = $derived(
		passwordRules.every((r) => r.valid) ? 'success' : password ? 'error' : 'default'
	);
	const canSubmit = $derived(
		passwordRules.every((r) => r.valid) &&
			(confirmPassword === '' || confirmPassword === password) &&
			!isSubmitting
	);

	// Show errors from remote function
	$effect(() => {
		const issues = registerRemote.fields.allIssues();
		if (issues && issues.length > 0) {
			toast.error(issues[0].message);
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
			<form
				{...registerRemote.enhance(async ({ submit }) => {
					isSubmitting = true;
					try {
						await submit();
					} finally {
						isSubmitting = false;
					}
				})}
				class="space-y-4"
			>
				<!-- Name Field -->
				<FormInput
					label="Full Name"
					name="name"
					type="text"
					placeholder="Nguyễn Văn A"
					bind:value={name}
					validationState={nameState}
					success={nameState === 'success' ? 'Name looks good' : undefined}
					required
				/>

				<!-- Phone Number Field (Required) -->
				<div class="space-y-2">
					<FormInput
						label="Phone Number"
						name="phoneNumber"
						type="tel"
						placeholder="0901234567"
						bind:value={phoneNumber}
						validationState={phoneState}
						success={phoneState === 'success' ? 'Phone number is valid' : undefined}
						required
					/>
					<p class="text-xs text-muted-foreground">Used to link debts to your account</p>
				</div>

				<!-- Email Field (Optional) -->
				<FormInput
					label="Email (Optional)"
					name="email"
					type="email"
					placeholder="name@example.com"
					bind:value={email}
					validationState={emailState}
					success={emailState === 'success' ? 'Email looks good' : undefined}
				/>

				<!-- Password Field -->
				<div class="space-y-2">
					<FormInput
						label="Password"
						name="password"
						type="password"
						placeholder="Create a strong password"
						bind:value={password}
						validationState={passwordState}
						success={passwordState === 'success' ? 'Strong password' : undefined}
						showPasswordToggle={true}
						required
					/>

					<!-- Password Requirements -->
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

				<!-- Submit Button -->
				<Button type="submit" class="h-10 w-full" disabled={!canSubmit}>
					<span class="inline-flex items-center justify-center">
						{#if isSubmitting}
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
