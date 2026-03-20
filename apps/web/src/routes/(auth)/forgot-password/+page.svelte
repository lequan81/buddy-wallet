<script lang="ts">
	import { resolve } from '$app/paths';
	import { CheckCircle, Loader2, Mail, Phone } from '@repo/icons';
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import { Button } from '@repo/ui/components/ui/button';
	import * as Card from '@repo/ui/components/ui/card';
	import FormInput from '$lib/components/forms/FormInput.svelte';

	import { emailSchema, phoneSchema, validateField } from '@repo/validation/client';
	let { form } = $props();

	let email = $state('');
	let phoneNumber = $state('');
	let isSubmitting = $state(false);
	let isSuccess = $state(false);

	// Validation driven by shared schema
	const emailValidation = $derived(validateField(emailSchema, email));
	const phoneValidation = $derived(validateField(phoneSchema, phoneNumber));

	const isValidEmail = $derived(emailValidation.state !== 'error' && email !== '');
	const isValidPhone = $derived(phoneValidation.state !== 'error' && phoneNumber !== '');
	const canSubmit = $derived(isValidEmail && isValidPhone && !isSubmitting && !isSuccess);

	// Show toast on form result
	$effect(() => {
		if (form?.success) {
			isSuccess = true;
			toast.success('Check your email for the secure reset link');
		}
		if (form?.message && !form?.success) {
			toast.error(form.message);
		}
	});
</script>

<div class="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
	<Card.Root class="w-full max-w-md">
		<Card.Header class="space-y-1 text-center">
			<Card.Title class="text-2xl font-bold">Forgot Password</Card.Title>
			<Card.Description>
				Enter your email and phone number to receive a secure reset link
			</Card.Description>
		</Card.Header>

		<Card.Content>
			{#if isSuccess}
				<div class="flex flex-col items-center space-y-4 py-8">
					<div class="rounded-full bg-green-100 p-3 dark:bg-green-900/30">
						<CheckCircle class="h-8 w-8 text-green-600 dark:text-green-400" />
					</div>
					<div class="text-center">
						<h3 class="font-semibold">Check Your Email</h3>
						<p class="mt-2 text-sm text-muted-foreground">
							If the email and phone number match our records, you'll receive a secure reset link
							shortly.
						</p>
						<p class="mt-4 text-sm text-muted-foreground">
							The secure reset link expires in 24 hours and can only be used once.
						</p>
					</div>
					<Button href={resolve(`/login`, {})} class="mt-4">Return to Login</Button>
				</div>
			{:else}
				<form
					method="POST"
					use:enhance={() => {
						isSubmitting = true;
						return async ({ update }) => {
							isSubmitting = false;
							await update();
						};
					}}
					class="space-y-4"
				>
					<!-- Info Banner -->
					<div
						class="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/30"
					>
						<p class="text-sm text-blue-800 dark:text-blue-200">
							For security, you must verify both your email and phone number to reset your password.
						</p>
					</div>

					<!-- Email Field -->
					<FormInput
						label="Email Address"
						name="email"
						type="email"
						placeholder="your@email.com"
						bind:value={email}
						validationState={emailValidation.state}
						error={emailValidation.message}
						required
						icon={Mail}
					/>

					<!-- Phone Field -->
					<FormInput
						label="Phone Number"
						name="phoneNumber"
						type="tel"
						placeholder="0901234567"
						bind:value={phoneNumber}
						validationState={phoneValidation.state}
						error={phoneValidation.message}
						required
						icon={Phone}
					/>

					<!-- Submit Button -->
					<Button type="submit" class="h-10 w-full" disabled={!canSubmit}>
						<span class="inline-flex items-center justify-center">
							{#if isSubmitting}
								<Loader2 class="mr-2 h-4 w-4 animate-spin" />
								Sending...
							{:else}
								Send Reset Link
							{/if}
						</span>
					</Button>
				</form>
			{/if}
		</Card.Content>

		{#if !isSuccess}
			<Card.Footer class="flex flex-col space-y-4">
				<div class="relative w-full">
					<div class="absolute inset-0 flex items-center">
						<span class="w-full border-t"></span>
					</div>
					<div class="relative flex justify-center text-xs uppercase">
						<span class="bg-card px-2 text-muted-foreground">Remember your password?</span>
					</div>
				</div>
				<Button variant="outline" class="h-10 w-full" href={resolve(`/login`, {})}>Back to Login</Button>
			</Card.Footer>
		{/if}
	</Card.Root>
</div>
