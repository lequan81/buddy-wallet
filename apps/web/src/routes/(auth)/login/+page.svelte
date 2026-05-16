<script lang="ts">
	import { resolve } from '$app/paths';
	import { Loader2 } from '@repo/icons';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { Button } from '@repo/ui/components/ui/button';
	import * as Card from '@repo/ui/components/ui/card';
	import FormInput from '$lib/components/forms/FormInput.svelte';

	import { loginRemote } from '$lib/remotes/auth.remote';
	import { loginRequestSchema as loginSchema } from '@repo/schema/dto/auth';
	import { validateField } from '@repo/schema/adapters';
	let { data } = $props();

	let email = $state('');
	let password = $state('');
	let isSubmitting = $state(false);

	// Validation driven by shared schema
	const emailValidation = $derived(validateField(loginSchema.entries.email, email));
	const isValidIdentifier = $derived(emailValidation.state !== 'error' && email !== '');
	const canSubmit = $derived(isValidIdentifier && password.length > 0 && !isSubmitting);

	// Show success toast after registration
	$effect(() => {
		if (data.registered) {
			toast.success('Account created successfully! Please sign in.');
			goto('/login', { replaceState: true });
		}
		if (data.verified) {
			toast.success('Email verified! You can now sign in.');
			goto('/login', { replaceState: true });
		}
	});

	// Show toast on form error
	$effect(() => {
		const issues = loginRemote.fields.allIssues();
		if (issues && issues.length > 0) {
			toast.error(issues[0].message);
		}
	});

	// NOTE: Do NOT preload /dashboard before login completes!
	// Preloading protected routes without auth caches "no user" state,
	// which causes issues after successful login.
</script>

<div class="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
	<Card.Root class="w-full max-w-md">
		<Card.Header class="space-y-1 text-center">
			<Card.Title class="text-2xl font-bold">Welcome back</Card.Title>
			<Card.Description>Enter your credentials to access your account</Card.Description>
		</Card.Header>

		<Card.Content>
			<form
				{...loginRemote.enhance(async ({ submit, data: _data }) => {
					isSubmitting = true;
					try {
						await submit();
					} finally {
						isSubmitting = false;
					}
				})}
				class="space-y-4"
			>
				<!-- Email/Phone Field -->
				<FormInput
					label="Email or Phone Number"
					name="email"
					type="text"
					placeholder="Email or 0901234567"
					bind:value={email}
					validationState={emailValidation.state}
					error={emailValidation.message}
					required
				/>

				<!-- Password Field -->
				<FormInput
					label="Password"
					name="password"
					type="password"
					placeholder="Enter your password"
					bind:value={password}
					validationState="default"
					showPasswordToggle={true}
					required
				/>

				<!-- Forgot Password Link -->
				<div class="text-right">
					<a
						href={resolve(`/forgot-password`, {})}
						data-sveltekit-preload-data="hover"
						class="text-sm text-primary hover:underline"
					>
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
			<Button
				variant="outline"
				class="h-10 w-full"
				href={resolve(`/signup`, {})}
				data-sveltekit-preload-data="hover">Create an account</Button
			>
		</Card.Footer>
	</Card.Root>
</div>
