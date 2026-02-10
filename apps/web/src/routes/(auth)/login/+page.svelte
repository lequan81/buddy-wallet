<script lang="ts">
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import { goto, invalidateAll, preloadData } from '$app/navigation';
	import { Loader2 } from '@lucide/svelte';
	import { Button } from '@repo/ui/components/ui/button';
	import * as Card from '@repo/ui/components/ui/card';
	import FormInput from '$lib/components/forms/FormInput.svelte';

	let { form, data } = $props();

	let email = $state('');
	let password = $state('');
	let isSubmitting = $state(false);
	
	// Validation states
	let emailError = $state('');
	let passwordError = $state('');

	/* Validation now accepts either email format or a phone number of sufficient length */
	const isValidIdentifier = $derived(email.length >= 3);
	const canSubmit = $derived(isValidIdentifier && password.length > 0 && !isSubmitting);

	// Validate email/phone  as user types
	$effect(() => {
		if (email.length > 0 && email.length < 3) {
			emailError = 'Must be at least 3 characters';
		} else {
			emailError = '';
		}
	});

	// Show success toast after registration
	$effect(() => {
		if (data.registered) {
			toast.success('Account created successfully! Please sign in.');
			// Clean up URL without reload
			goto('/login', { replaceState: true });
		}
	});

	// Show toast on form error
	$effect(() => {
		if (form?.message) {
			toast.error(form.message);
		}
	});

	// Preload dashboard when user starts typing (likely to login)
	let hasPreloadedDashboard = false;
	$effect(() => {
		if (email.length > 0 && password.length > 0 && !hasPreloadedDashboard) {
			hasPreloadedDashboard = true;
			// Preload dashboard in background as user is likely to login
			preloadData('/dashboard').catch(() => {});
		}
	});
</script>

<div class="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
	<Card.Root class="w-full max-w-md">
		<Card.Header class="space-y-1 text-center">
			<Card.Title class="text-2xl font-bold">Welcome back</Card.Title>
			<Card.Description>Enter your credentials to access your account</Card.Description>
		</Card.Header>

		<Card.Content>
			<form
				method="POST"
				use:enhance={() => {
					isSubmitting = true;
					return async ({ result, update }) => {
						isSubmitting = false;

						// If login successful (redirect), invalidate all data to reload user state
						if (result.type === 'redirect') {
							await invalidateAll();
							await goto(result.location, { invalidateAll: true });
						} else {
							// For errors, just update the form
							await update();
						}
					};
				}}
				class="space-y-4"
			>
				<!-- Email/Phone Field -->
				<FormInput
					label="Email or Phone Number"
					name="email"
					type="text"
					placeholder="Email or 0901234567"
					bind:value={email}
					validationState={emailError ? 'error' : 'default'}
					error={emailError}
					required
				/>

				<!-- Password Field -->
				<FormInput
					label="Password"
					name="password"
					type="password"
					placeholder="Enter your password"
					bind:value={password}
					validationState={passwordError ? 'error' : 'default'}
					error={passwordError}
					showPasswordToggle={true}
					required
				/>

				<!-- Forgot Password Link -->
				<div class="text-right">
					<a href="/forgot-password" data-sveltekit-preload-data="hover" class="text-sm text-primary hover:underline">
						Forgot password?
					</a>
				</div>

				<!-- Submit Button - Fixed height -->
				<Button type="submit" class="h-10 w-full" disabled={!canSubmit}>
					<span class="inline-flex items-center justify-center">
						{#if isSubmitting}
							<Loader2 class="mr-2 h-4 w-4 animate-spin" />
							Signing in...
						{:else}
							Sign in
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
					<span class="bg-card px-2 text-muted-foreground"> New to Buddy Wallet? </span>
				</div>
			</div>
			<Button variant="outline" class="h-10 w-full" href="/signup" data-sveltekit-preload-data="hover">Create an account</Button>
		</Card.Footer>
	</Card.Root>
</div>
