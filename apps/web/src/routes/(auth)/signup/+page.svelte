<script lang="ts">
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import { Eye, EyeOff, Check, Circle, Loader2 } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	
	let { form } = $props();
	
	let name = $state('');
	let phoneNumber = $state('');
	let email = $state('');
	let password = $state('');
	let showPassword = $state(false);
	let isSubmitting = $state(false);
	
	// Password validation rules
	const passwordRules = $derived([
		{ label: 'At least 8 characters', valid: password.length >= 8 },
		{ label: 'One uppercase letter', valid: /[A-Z]/.test(password) },
		{ label: 'One lowercase letter', valid: /[a-z]/.test(password) },
		{ label: 'One number', valid: /\d/.test(password) },
	]);
	
	const isPasswordValid = $derived(passwordRules.every(rule => rule.valid));
	const isPhoneValid = $derived(phoneNumber.length >= 10);
	const isNameValid = $derived(name.trim().length >= 2);
	const canSubmit = $derived(isNameValid && isPhoneValid && isPasswordValid && !isSubmitting);
	
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
			<Card.Title class="text-2xl font-bold">Create an account</Card.Title>
			<Card.Description>
				Enter your email and password to get started
			</Card.Description>
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
				<!-- Name Field -->
				<div class="space-y-2">
					<Label for="name">Full Name</Label>
					<Input 
						id="name" 
						name="name" 
						type="text" 
						placeholder="Nguyễn Văn A"
						autocomplete="name"
						required
						bind:value={name}
					/>
				</div>
				
				<!-- Phone Number Field (Required) -->
				<div class="space-y-2">
					<Label for="phoneNumber">Phone Number</Label>
					<Input 
						id="phoneNumber" 
						name="phoneNumber" 
						type="tel" 
						placeholder="0901234567"
						autocomplete="tel"
						required
						bind:value={phoneNumber}
					/>
					<p class="text-xs text-muted-foreground">Used to link debts to your account</p>
				</div>
				
				<!-- Email Field (Optional) -->
				<div class="space-y-2">
					<Label for="email">Email (Optional)</Label>
					<Input 
						id="email" 
						name="email" 
						type="email" 
						placeholder="name@example.com"
						autocomplete="email"
						bind:value={email}
					/>
				</div>
				
				<!-- Password Field -->
				<div class="space-y-2">
					<Label for="password">Password</Label>
					<div class="relative">
						<Input 
							id="password" 
							name="password" 
							type={showPassword ? 'text' : 'password'}
							placeholder="Create a strong password"
							autocomplete="new-password"
							required
							bind:value={password}
							class="pr-10"
						/>
						<button
							type="button"
							onclick={() => showPassword = !showPassword}
							class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
							aria-label={showPassword ? 'Hide password' : 'Show password'}
						>
							{#if showPassword}
								<EyeOff class="h-4 w-4" />
							{:else}
								<Eye class="h-4 w-4" />
							{/if}
						</button>
					</div>
					
					<!-- Password Requirements - Always visible, no layout shift -->
					<div class="grid grid-cols-2 gap-x-4 gap-y-1 pt-2">
						{#each passwordRules as rule}
							<div class="flex items-center gap-1.5 text-xs">
								{#if rule.valid}
									<Check class="h-3 w-3 text-green-500 shrink-0" />
									<span class="text-green-600 dark:text-green-400">{rule.label}</span>
								{:else}
									<Circle class="h-3 w-3 text-muted-foreground/50 shrink-0" />
									<span class="text-muted-foreground">{rule.label}</span>
								{/if}
							</div>
						{/each}
					</div>
				</div>
				
				<!-- Submit Button - Fixed height -->
				<Button 
					type="submit" 
					class="w-full h-10" 
					disabled={!canSubmit}
				>
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
					<span class="bg-card px-2 text-muted-foreground">
						Already have an account?
					</span>
				</div>
			</div>
			<Button variant="outline" class="w-full h-10" href="/login">
				Sign in
			</Button>
		</Card.Footer>
	</Card.Root>
</div>
