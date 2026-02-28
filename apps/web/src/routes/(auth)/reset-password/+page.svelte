<script lang="ts">
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	// @ts-ignore
	import IconLucideLoader2 from '~icons/lucide/loader-2';
	// @ts-ignore
	import IconLucideLock from '~icons/lucide/lock';
	import { Button } from '@repo/ui/components/ui/button';
	import * as Card from '@repo/ui/components/ui/card';
	import FormInput from '$lib/components/forms/FormInput.svelte';

	let { form, data } = $props();

	let newPassword = $state('');
	let confirmPassword = $state('');
	let isSubmitting = $state(false);

	// Validation states
	let passwordError = $state('');
	let confirmError = $state('');

	// Validation
	const isValidPassword = $derived(newPassword.length >= 8);
	const isMatching = $derived(newPassword === confirmPassword);
	const canSubmit = $derived(isValidPassword && isMatching && !isSubmitting);

	// Validate as user types
	$effect(() => {
		if (newPassword.length > 0 && newPassword.length < 8) {
			passwordError = 'Password must be at least 8 characters';
		} else {
			passwordError = '';
		}
	});

	$effect(() => {
		if (confirmPassword.length > 0 && newPassword !== confirmPassword) {
			confirmError = 'Passwords do not match';
		} else {
			confirmError = '';
		}
	});

	$effect(() => {
		if (form?.message) {
			toast.error(form.message);
		}
	});
</script>

<div class="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
	<Card.Root class="w-full max-w-md">
		<Card.Header class="space-y-1 text-center">
			<Card.Title class="text-2xl font-bold">Set New Password</Card.Title>
			<Card.Description>Please enter a strong new password for your account.</Card.Description>
		</Card.Header>

		<Card.Content>
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
				<!-- Hidden Context -->
				<input type="hidden" name="token" value={data.token} />
				<input type="hidden" name="email" value={data.email} />

				<!-- New Password Field -->
				<FormInput
					label="New Password"
					name="newPassword"
					type="password"
					placeholder="••••••••"
					bind:value={newPassword}
					validationState={passwordError ? 'error' : 'default'}
					error={passwordError}
					required
					icon={IconLucideLock}
				/>

				<!-- Confirm Password Field -->
				<FormInput
					label="Confirm Password"
					name="confirmPassword"
					type="password"
					placeholder="••••••••"
					bind:value={confirmPassword}
					validationState={confirmError ? 'error' : 'default'}
					error={confirmError}
					required
					icon={IconLucideLock}
				/>

				<!-- Submit Button -->
				<Button type="submit" class="h-10 w-full" disabled={!canSubmit}>
					<span class="inline-flex items-center justify-center">
						{#if isSubmitting}
							<IconLucideLoader2 class="mr-2 h-4 w-4 animate-spin" />
							Resetting Password...
						{:else}
							Reset Password
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
					<span class="bg-card px-2 text-muted-foreground">Or return to login</span>
				</div>
			</div>
			<Button variant="outline" class="h-10 w-full" href="/login">Back to Login</Button>
		</Card.Footer>
	</Card.Root>
</div>
