<script lang="ts">
	import { Loader2, ShieldCheck } from '@repo/icons';
	import { toast } from 'svelte-sonner';
	import { Button } from '@repo/ui/components/ui/button';
	import * as Card from '@repo/ui/components/ui/card';
	import { createTreatyClient } from '$lib/services/api';
		import { goto } from '$app/navigation';

	let { data } = $props();

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

	async function handleVerify() {
		if (!canSubmit) return;
		isSubmitting = true;

		try {
			const api = createTreatyClient(fetch);
			const { error } = await api.v1.auth['verify-email'].post({ token: otp });

			if (error) {
				toast.error((error.value?.message || 'Verification failed'));
			} else {
				toast.success('Email verified!');
				await goto('/');
			}
		} catch {
			toast.error('Unable to connect to server. Please try again.');
		} finally {
			isSubmitting = false;
		}
	}

	async function handleSkip() {
		try {
			await goto('/login');
		} catch {
			toast.error('Unable to connect to server.');
		}
	}
</script>

<div class="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
	<Card.Root class="w-full max-w-md">
		<Card.Header class="space-y-2 text-center">
			<div
				class="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10"
			>
				<ShieldCheck class="h-7 w-7 text-primary" />
			</div>
			<Card.Title class="text-2xl font-bold">Verify your email</Card.Title>
			<Card.Description>
				We sent a 6-digit code to
				<span class="font-medium text-foreground">{data.email}</span>
			</Card.Description>
		</Card.Header>

		<Card.Content>
			<form
				onsubmit={(e) => { e.preventDefault(); handleVerify(); }}
				class="space-y-6"
			>
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
								focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
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
							<Loader2 class="mr-2 h-4 w-4 animate-spin" />
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
			<Button variant="ghost" type="button" class="h-10 w-full text-muted-foreground" onclick={handleSkip}>
				Skip for now
			</Button>
		</Card.Footer>
	</Card.Root>
</div>
