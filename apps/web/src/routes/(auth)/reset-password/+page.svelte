<script lang="ts">
	import { resolve } from '$app/paths';
	import { Loader2, Lock } from '@repo/icons';
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import { Button } from '@repo/ui/components/ui/button';
	import * as Card from '@repo/ui/components/ui/card';
	import FormInput from '$lib/components/forms/FormInput.svelte';

	import { passwordSchema, validateField } from '@repo/schema/dto/auth';
	let { form, data } = $props();

	let newPassword = $state('');
	let confirmPassword = $state('');
	let isSubmitting = $state(false);

	// Validation driven by shared schema
	const passwordValidation = $derived(validateField(passwordSchema, newPassword));
	const isMatching = $derived(newPassword === confirmPassword);
	const isValidPassword = $derived(passwordValidation.state !== 'error' && newPassword !== '');
	const canSubmit = $derived(isValidPassword && isMatching && !isSubmitting);

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
					validationState={passwordValidation.state}
					error={passwordValidation.message}
					required
					icon={Lock}
				/>

				<!-- Confirm Password Field -->
				<FormInput
					label="Confirm Password"
					name="confirmPassword"
					type="password"
					placeholder="••••••••"
					bind:value={confirmPassword}
					validationState={confirmPassword === '' ? 'default' : isMatching ? 'success' : 'error'}
					error={confirmPassword !== '' && !isMatching ? 'Passwords do not match' : undefined}
					required
					icon={Lock}
				/>

				<!-- Submit Button -->
				<Button type="submit" class="h-10 w-full" disabled={!canSubmit}>
					<span class="inline-flex items-center justify-center">
						{#if isSubmitting}
							<Loader2 class="mr-2 h-4 w-4 animate-spin" />
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
			<Button variant="outline" class="h-10 w-full" href={resolve(`/login`, {})}>Back to Login</Button>
		</Card.Footer>
	</Card.Root>
</div>
