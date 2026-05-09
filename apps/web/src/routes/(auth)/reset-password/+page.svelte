<script lang="ts">
	import { resolve } from '$app/paths';
	import { Loader2, Lock } from '@repo/icons';
	import { toast } from 'svelte-sonner';
	import { Button } from '@repo/ui/components/ui/button';
	import * as Card from '@repo/ui/components/ui/card';
	import FormInput from '$lib/components/forms/FormInput.svelte';

	import { resetPasswordRemote } from '$lib/remotes/auth.remote';
	import { passwordSchema, validateField } from '@repo/schema/dto/auth';

	// No props needed — token is read from URL by the remote function

	let newPassword = $state('');
	let confirmPassword = $state('');
	let isSubmitting = $state(false);

	// Validation driven by shared schema
	const passwordValidation = $derived(validateField(passwordSchema, newPassword));
	const isMatching = $derived(newPassword === confirmPassword);
	const isValidPassword = $derived(passwordValidation.state !== 'error' && newPassword !== '');
	const canSubmit = $derived(isValidPassword && isMatching && !isSubmitting);

	// Show errors from remote function
	$effect(() => {
		const issues = resetPasswordRemote.fields.allIssues();
		if (issues && issues.length > 0) {
			toast.error(issues[0].message);
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
				{...resetPasswordRemote.enhance(async ({ submit }) => {
					isSubmitting = true;
					try {
						await submit();
					} finally {
						isSubmitting = false;
					}
				})}
				class="space-y-4"
			>
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
