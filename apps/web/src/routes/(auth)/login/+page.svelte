<script lang="ts">
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import { goto, invalidateAll } from '$app/navigation';
	import { Eye, EyeOff, Loader2 } from '@lucide/svelte';
	import { Button } from '@repo/ui/components/ui/button';
	import { Input } from '@repo/ui/components/ui/input';
	import { Label } from '@repo/ui/components/ui/label';
	import * as Card from '@repo/ui/components/ui/card';

	let { form, data } = $props();

	let email = $state('');
	let password = $state('');
	let showPassword = $state(false);
	let isSubmitting = $state(false);

	/* Validation now accepts either email format or a phone number of sufficient length */
	const isValidIdentifier = $derived(email.length >= 3);

	const canSubmit = $derived(isValidIdentifier && password.length > 0 && !isSubmitting);

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
				<div class="space-y-2">
					<Label for="email">Email or Phone Number</Label>
					<Input
						id="email"
						name="email"
						type="text"
						placeholder="Email or 0901234567"
						autocomplete="username"
						required
						bind:value={email}
					/>
				</div>

				<!-- Password Field -->
				<div class="space-y-2">
					<div class="flex items-center justify-between">
						<Label for="password">Password</Label>
						<a
							href="/forgot-password"
							class="text-xs text-muted-foreground transition-colors hover:text-primary"
						>
							Forgot password?
						</a>
					</div>
					<div class="relative">
						<Input
							id="password"
							name="password"
							type={showPassword ? 'text' : 'password'}
							placeholder="Enter your password"
							autocomplete="current-password"
							required
							bind:value={password}
							class="pr-10"
						/>
						<button
							type="button"
							onclick={() => (showPassword = !showPassword)}
							class="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
							aria-label={showPassword ? 'Hide password' : 'Show password'}
						>
							{#if showPassword}
								<EyeOff class="h-4 w-4" />
							{:else}
								<Eye class="h-4 w-4" />
							{/if}
						</button>
					</div>
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
			<Button variant="outline" class="h-10 w-full" href="/signup">Create an account</Button>
		</Card.Footer>
	</Card.Root>
</div>
