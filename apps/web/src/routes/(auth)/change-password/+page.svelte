<script lang="ts">
	import { resolve } from '$app/paths';
	import AlertTriangle from '~icons/lucide/alert-triangle';
import Loader2 from '~icons/lucide/loader2';
import Lock from '~icons/lucide/lock';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Alert from '$lib/components/ui/alert';
	import FormInput from '$lib/components/forms/FormInput.svelte';
	import { cn } from '$lib/utils';

	let { form, data } = $props();

	let newPassword = $state('');
	let confirmPassword = $state('');
	let isSubmitting = $state(false);
	// Password requirements
	const hasMinLength = $derived(newPassword.length >= 8);
	const hasUppercase = $derived(/[A-Z]/.test(newPassword));
	const hasLowercase = $derived(/[a-z]/.test(newPassword));
	const hasNumber = $derived(/[0-9]/.test(newPassword));
	const hasSpecial = $derived(/[!@#$%^&*(),.?":{}|<>]/.test(newPassword));
	const passwordsMatch = $derived(newPassword === confirmPassword && confirmPassword.length > 0);

	const isValidPassword = $derived(hasMinLength && hasUppercase && hasLowercase && hasNumber);
	const canSubmit = $derived(isValidPassword && passwordsMatch && !isSubmitting);

	// Validation messages derived from reactive state (replaces $effect)
	const passwordError = $derived(
		newPassword.length > 0 && !isValidPassword ? 'Password does not meet requirements' : ''
	);
	const confirmError = $derived(
		confirmPassword.length > 0 && !passwordsMatch ? 'Passwords do not match' : ''
	);

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
				<Alert.Root
					class="mb-4 border-yellow-500 bg-yellow-50 dark:border-yellow-600 dark:bg-yellow-950/20"
				>
					<AlertTriangle class="h-4 w-4 text-yellow-600" />
					<Alert.Title class="text-yellow-900 dark:text-yellow-100"
						>Password Change Required</Alert.Title
					>
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
					icon={Lock}
				/>

				<!-- Password Requirements -->
				<div class="rounded-lg border bg-muted/50 p-3">
					<p class="mb-2 text-xs font-medium text-muted-foreground">Password requirements:</p>
					<ul class="space-y-1 text-xs">
						<li
							class={cn(
								hasMinLength ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
							)}
						>
							{hasMinLength ? '✔' : '○'} At least 8 characters
						</li>
						<li
							class={cn(
								hasUppercase ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
							)}
						>
							{hasUppercase ? '✔' : '○'} One uppercase letter
						</li>
						<li
							class={cn(
								hasLowercase ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
							)}
						>
							{hasLowercase ? '✔' : '○'} One lowercase letter
						</li>
						<li
							class={cn(
								hasNumber ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
							)}
						>
							{hasNumber ? '✔' : '○'} One number
						</li>
						<li
							class={cn(
								hasSpecial ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
							)}
						>
							{hasSpecial ? '✔' : '○'} One special character (recommended)
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
					icon={Lock}
				/>

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
				<Button variant="outline" class="h-10 w-full" href={resolve(`/dashboard`, {})}>Cancel</Button>
			</Card.Footer>
		{/if}
	</Card.Root>
</div>
