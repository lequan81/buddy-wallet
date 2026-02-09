<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { Loader2, Lock, AlertTriangle } from '@lucide/svelte';
	import { Button } from '@repo/ui/components/ui/button';
	import * as Card from '@repo/ui/components/ui/card';
	import * as Alert from '@repo/ui/components/ui/alert';
	import FormInput from '$lib/components/forms/FormInput.svelte';

	let { form, data } = $props();

	let newPassword = $state('');
	let confirmPassword = $state('');
	let isSubmitting = $state(false);

	// Validation states
	let passwordError = $state('');
	let confirmError = $state('');

	// Password requirements
	const hasMinLength = $derived(newPassword.length >= 8);
	const hasUppercase = $derived(/[A-Z]/.test(newPassword));
	const hasLowercase = $derived(/[a-z]/.test(newPassword));
	const hasNumber = $derived(/[0-9]/.test(newPassword));
	const hasSpecial = $derived(/[!@#$%^&*(),.?":{}|<>]/.test(newPassword));
	const passwordsMatch = $derived(newPassword === confirmPassword && confirmPassword.length > 0);
	
	const isValidPassword = $derived(hasMinLength && hasUppercase && hasLowercase && hasNumber);
	const canSubmit = $derived(isValidPassword && passwordsMatch && !isSubmitting);

	// Validate as user types
	$effect(() => {
		if (newPassword.length > 0 && !isValidPassword) {
			passwordError = 'Password does not meet requirements';
		} else {
			passwordError = '';
		}
	});

	$effect(() => {
		if (confirmPassword.length > 0 && !passwordsMatch) {
			confirmError = 'Passwords do not match';
		} else {
			confirmError = '';
		}
	});

	// Show toast on form result
	$effect(() => {
		if (form?.success) {
			toast.success('Password changed successfully! Please log in again.');
			goto('/login');
		}
		if (form?.message && !form?.success) {
			toast.error(form.message);
		}
	});

	// Prevent navigation if password change is required
	$effect(() => {
		if (data.required) {
			const handler = (e: BeforeUnloadEvent) => {
				e.preventDefault();
				e.returnValue = '';
			};
			window.addEventListener('beforeunload', handler);
			return () => window.removeEventListener('beforeunload', handler);
		}
	});
</script>

<div class="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
	<Card.Root class="w-full max-w-md">
		<Card.Header class="space-y-1 text-center">
			<Card.Title class="text-2xl font-bold">Change Password</Card.Title>
			<Card.Description>
				{#if data.required}
					You must change your password to continue
				{:else}
					Create a new secure password for your account
				{/if}
			</Card.Description>
		</Card.Header>

		<Card.Content>
			{#if data.required}
				<Alert.Root class="mb-4 border-yellow-500 bg-yellow-50 dark:border-yellow-600 dark:bg-yellow-950/20">
					<AlertTriangle class="h-4 w-4 text-yellow-600" />
					<Alert.Title class="text-yellow-900 dark:text-yellow-100">Password Change Required</Alert.Title>
					<Alert.Description class="text-yellow-800 dark:text-yellow-200">
						For security reasons, you must set a new password before continuing.
					</Alert.Description>
				</Alert.Root>
			{/if}

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
				<!-- New Password Field -->
				<FormInput
					label="New Password"
					name="newPassword"
					type="password"
					placeholder="Enter new password"
					bind:value={newPassword}
					validationState={passwordError ? 'error' : 'default'}
					error={passwordError}
					showPasswordToggle={true}
					required
				>
					{#snippet iconLeft()}
						<Lock class="h-4 w-4 text-muted-foreground" />
					{/snippet}
				</FormInput>

				<!-- Password Requirements -->
				<div class="rounded-lg border bg-muted/50 p-3">
					<p class="mb-2 text-xs font-medium text-muted-foreground">Password requirements:</p>
					<ul class="space-y-1 text-xs">
						<li class:text-green-600={hasMinLength} class:dark:text-green-400={hasMinLength} class:text-muted-foreground={!hasMinLength}>
							{hasMinLength ? '✓' : '○'} At least 8 characters
						</li>
						<li class:text-green-600={hasUppercase} class:dark:text-green-400={hasUppercase} class:text-muted-foreground={!hasUppercase}>
							{hasUppercase ? '✓' : '○'} One uppercase letter
						</li>
						<li class:text-green-600={hasLowercase} class:dark:text-green-400={hasLowercase} class:text-muted-foreground={!hasLowercase}>
							{hasLowercase ? '✓' : '○'} One lowercase letter
						</li>
						<li class:text-green-600={hasNumber} class:dark:text-green-400={hasNumber} class:text-muted-foreground={!hasNumber}>
							{hasNumber ? '✓' : '○'} One number
						</li>
						<li class:text-green-600={hasSpecial} class:dark:text-green-400={hasSpecial} class:text-muted-foreground={!hasSpecial}>
							{hasSpecial ? '✓' : '○'} One special character (recommended)
						</li>
					</ul>
				</div>

				<!-- Confirm Password Field -->
				<FormInput
					label="Confirm New Password"
					name="confirmPassword"
					type="password"
					placeholder="Confirm new password"
					bind:value={confirmPassword}
					validationState={confirmError ? 'error' : passwordsMatch ? 'success' : 'default'}
					error={confirmError}
					showPasswordToggle={true}
					required
				>
					{#snippet iconLeft()}
						<Lock class="h-4 w-4 text-muted-foreground" />
					{/snippet}
				</FormInput>

				<!-- Submit Button -->
				<Button type="submit" class="h-10 w-full" disabled={!canSubmit}>
					<span class="inline-flex items-center justify-center">
						{#if isSubmitting}
							<Loader2 class="mr-2 h-4 w-4 animate-spin" />
							Changing Password...
						{:else}
							Change Password
						{/if}
					</span>
				</Button>
			</form>
		</Card.Content>

		{#if !data.required}
			<Card.Footer>
				<Button variant="outline" class="h-10 w-full" href="/login">Cancel</Button>
			</Card.Footer>
		{/if}
	</Card.Root>
</div>
