<script lang="ts">
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import { Button } from '@repo/ui/components/ui/button';
	import * as Card from '@repo/ui/components/ui/card';
	// @ts-ignore
	import IconLucideShieldCheck from '~icons/lucide/shield-check';
	// @ts-ignore
	import IconLucideLoader2 from '~icons/lucide/loader-2';

	let { data, form } = $props();

	// 6-digit OTP state
	let digits = $state(['', '', '', '', '', '']);
	let inputRefs: HTMLInputElement[] = [];
	let isSubmitting = $state(false);

	const otp = $derived(digits.join(''));
	const canSubmit = $derived(otp.length === 6 && !isSubmitting);

	function handleInput(index: number, event: Event) {
		const target = event.target as HTMLInputElement;
		const value = target.value;

		// Only allow digits
		if (value && !/^\d$/.test(value)) {
			target.value = '';
			return;
		}

		digits[index] = value;

		// Auto-focus next input
		if (value && index < 5) {
			inputRefs[index + 1]?.focus();
		}
	}

	function handleKeydown(index: number, event: KeyboardEvent) {
		if (event.key === 'Backspace' && !digits[index] && index > 0) {
			inputRefs[index - 1]?.focus();
		}
	}

	function handlePaste(event: ClipboardEvent) {
		event.preventDefault();
		const text = event.clipboardData?.getData('text')?.replace(/\D/g, '').slice(0, 6) || '';
		for (let i = 0; i < 6; i++) {
			digits[i] = text[i] || '';
		}
		// Focus last filled or first empty
		const focusIndex = Math.min(text.length, 5);
		inputRefs[focusIndex]?.focus();
	}

	// Show errors from server
	$effect(() => {
		if (form?.message) {
			toast.error(form.message);
		}
	});
</script>

<div class="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
	<Card.Root class="w-full max-w-md">
		<Card.Header class="space-y-2 text-center">
			<div
				class="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10"
			>
				<IconLucideShieldCheck class="h-7 w-7 text-primary" />
			</div>
			<Card.Title class="text-2xl font-bold">Verify your email</Card.Title>
			<Card.Description>
				We sent a 6-digit code to
				<span class="font-medium text-foreground">{data.email}</span>
			</Card.Description>
		</Card.Header>

		<Card.Content>
			<form
				method="POST"
				action="?/verify"
				use:enhance={() => {
					isSubmitting = true;
					return async ({ result, update }) => {
						isSubmitting = false;
						if (result.type === 'redirect') {
							window.location.href = result.location;
						} else {
							await update();
						}
					};
				}}
				class="space-y-6"
			>
				<!-- Hidden input to send the full OTP -->
				<input type="hidden" name="otp" value={otp} />

				<!-- 6-digit OTP input grid -->
				<div class="flex justify-center gap-3">
					{#each digits as _, i}
						<input
							bind:this={inputRefs[i]}
							type="text"
							inputmode="numeric"
							maxlength="1"
							class="h-14 w-12 rounded-lg border-2 border-input bg-background text-center text-xl font-bold
								transition-all duration-150
								focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none
								{form?.message ? 'border-destructive' : ''}"
							value={digits[i]}
							oninput={(e) => handleInput(i, e)}
							onkeydown={(e) => handleKeydown(i, e)}
							onpaste={i === 0 ? handlePaste : undefined}
							autocomplete="one-time-code"
						/>
					{/each}
				</div>

				<!-- Verify Button -->
				<Button type="submit" class="h-11 w-full text-base" disabled={!canSubmit}>
					<span class="inline-flex items-center justify-center">
						{#if isSubmitting}
							<IconLucideLoader2 class="mr-2 h-4 w-4 animate-spin" />
							Verifying...
						{:else}
							Verify Email
						{/if}
					</span>
				</Button>
			</form>
		</Card.Content>

		<Card.Footer class="flex flex-col space-y-3">
			<!-- Skip -->
			<form method="POST" action="?/skip" class="w-full">
				<Button variant="ghost" type="submit" class="h-10 w-full text-muted-foreground">
					Skip for now
				</Button>
			</form>
		</Card.Footer>
	</Card.Root>
</div>
