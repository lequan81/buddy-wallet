<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '@repo/ui/components/ui/button';
	import * as Card from '@repo/ui/components/ui/card';
	import FormInput from '$lib/components/forms/FormInput.svelte';
	import { checkDebtByPhone } from '$lib/api';
	import { Users, FileCheck, Lock, Zap, Loader2, Phone } from '@lucide/svelte';

	let { data } = $props();
	let isLoggedIn = $derived(!!data.user);

	let phoneNumber = $state('');
	let checking = $state(false);
	let result = $state<{
		success: boolean;
		phone: string;
		found: boolean;
		count: number;
	} | null>(null);
	let error = $state('');

	type ValidationState = 'default' | 'success' | 'error' | 'warning';
	let validationState: ValidationState = $derived.by(() => {
		if (error) return 'error';
		if (result) return 'success';
		return 'default';
	});

	async function handleCheckDebt() {
		if (phoneNumber.length < 9) {
			error = 'Phone number must be at least 9 digits';
			return;
		}

		checking = true;
		error = '';
		result = null;

		const res = await checkDebtByPhone(phoneNumber);
		checking = false;

		if (res.error) {
			error = res.error;
		} else if (res.data) {
			result = res.data;
		}
	}
</script>

<svelte:head>
	<title>Buddy Wallet - Track Debts with Friends</title>
	<meta name="description" content="Simple debt tracking for friends and close relationships" />
</svelte:head>

<!-- Hero Section with Debt Checker -->
<section class="px-4 py-12 sm:px-6 sm:py-20 lg:px-8">
	<div class="mx-auto max-w-4xl">
		<div class="text-center">
			<h1 class="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
				Track Debts with Friends
			</h1>
			<p class="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
				Simple, transparent debt tracking for friends and close relationships. Keep your finances
				clear and relationships healthy.
			</p>
		</div>

		<!-- Debt Checker Card - Only show when not logged in -->
		{#if !isLoggedIn}
			<Card.Root class="mx-auto mt-12 max-w-md">
				<Card.Header>
					<Card.Title class="text-center">Check Your Debt Status</Card.Title>
					<Card.Description class="text-center">
						Enter your phone number to see if you have any pending debts
					</Card.Description>
				</Card.Header>
				<Card.Content class="space-y-4">
					<FormInput
						label="Phone Number"
						name="phoneNumber"
						type="tel"
						placeholder="0901234567"
						bind:value={phoneNumber}
						{validationState}
						{error}
						success={result ? `Checked: ${result.phone}` : undefined}
						icon={Phone}
						required
					/>

					<Button
						onclick={handleCheckDebt}
						disabled={checking || phoneNumber.length < 9}
						class="w-full"
					>
						{#if checking}
							<Loader2 class="mr-2 h-4 w-4 animate-spin" />
							Checking...
						{:else}
							Check Status
						{/if}
					</Button>

					{#if result}
						<div
							class="rounded-lg border p-4 {result.found
								? 'border-warning bg-warning/10'
								: 'border-success bg-success/10'}"
						>
							{#if result.found}
								<p class="mb-2 text-center font-medium text-warning">
									You have {result.count} pending debt{result.count !== 1 ? 's' : ''}
								</p>
								<Button href="/login" variant="default" class="w-full">View Details</Button>
							{:else}
								<p class="mb-2 text-center font-medium text-success">No pending debts found</p>
								<Button href="/signup" variant="outline" class="w-full">Create Account</Button>
							{/if}
						</div>
					{/if}
				</Card.Content>
			</Card.Root>

			<!-- CTA Buttons for non-logged in users -->
			<div class="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
				<Button onclick={() => goto('/signup')} size="lg">Get Started</Button>
				<Button onclick={() => goto('/login')} variant="outline" size="lg">Sign In</Button>
			</div>
		{:else}
			<!-- Logged in user CTA -->
			<div class="mx-auto mt-12 max-w-md text-center">
				<p class="mb-6 text-lg text-muted-foreground">Welcome back! Ready to manage your debts?</p>
				<div class="flex flex-col gap-4 sm:flex-row sm:justify-center">
					<Button onclick={() => goto('/dashboard')} size="lg">Go to Dashboard</Button>
					<Button onclick={() => goto('/debts/create')} variant="outline" size="lg">Create Debt</Button>
				</div>
			</div>
		{/if}
	</div>
</section>

<!-- Features Section -->
<section class="border-t bg-muted/30 px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
	<div class="mx-auto max-w-5xl">
		<div class="mb-12 text-center">
			<h2 class="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
				Why Choose Buddy Wallet?
			</h2>
			<p class="mt-4 text-lg text-muted-foreground">
				Everything you need to track and settle debts with friends
			</p>
		</div>

		<div class="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
			<!-- Feature 1: Easy Tracking -->
			<div class="rounded-lg border bg-card p-6 transition-shadow hover:shadow-md">
				<div class="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
					<Users class="h-6 w-6 text-primary" />
				</div>
				<h3 class="mb-2 text-lg font-semibold text-card-foreground">Easy Tracking</h3>
				<p class="text-sm text-muted-foreground">
					Record debts quickly with just a phone number, amount, and description.
				</p>
			</div>

			<!-- Feature 2: Clear Records -->
			<div class="rounded-lg border bg-card p-6 transition-shadow hover:shadow-md">
				<div class="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
					<FileCheck class="h-6 w-6 text-primary" />
				</div>
				<h3 class="mb-2 text-lg font-semibold text-card-foreground">Clear Records</h3>
				<p class="text-sm text-muted-foreground">
					See all balances and transaction history at a glance. Full transparency.
				</p>
			</div>

			<!-- Feature 3: Safe & Private -->
			<div class="rounded-lg border bg-card p-6 transition-shadow hover:shadow-md">
				<div class="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
					<Lock class="h-6 w-6 text-primary" />
				</div>
				<h3 class="mb-2 text-lg font-semibold text-card-foreground">Safe & Private</h3>
				<p class="text-sm text-muted-foreground">
					Your financial data is encrypted and protected. Privacy-focused design.
				</p>
			</div>

			<!-- Feature 4: Fast Settlement -->
			<div class="rounded-lg border bg-card p-6 transition-shadow hover:shadow-md">
				<div class="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
					<Zap class="h-6 w-6 text-primary" />
				</div>
				<h3 class="mb-2 text-lg font-semibold text-card-foreground">Fast Settlement</h3>
				<p class="text-sm text-muted-foreground">
					Quick debt confirmation and settlement with payment proof upload.
				</p>
			</div>
		</div>
	</div>
</section>

<!-- CTA Section -->
<section class="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
	<div class="mx-auto max-w-3xl text-center">
		<h2 class="text-3xl font-bold text-foreground sm:text-4xl">Start tracking debts today</h2>
		<p class="mt-4 text-lg text-muted-foreground">
			Join others who trust Buddy Wallet to manage shared expenses.
		</p>
		<div class="mt-8">
			<Button onclick={() => goto('/signup')} size="lg">Create Account</Button>
		</div>
	</div>
</section>

<!-- Links Section -->
<section class="border-t border-gray-200 px-4 py-12 sm:px-6 sm:py-16 lg:px-8 dark:border-gray-700">
	<div class="mx-auto max-w-5xl">
		<div class="grid gap-6 text-center sm:grid-cols-3">
			<a
				href="/about"
				class="font-medium text-gray-600 transition-colors hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400"
			>
				About Us
			</a>
			<a
				href="/faq"
				class="font-medium text-gray-600 transition-colors hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400"
			>
				FAQ
			</a>
			<a
				href="/terms"
				class="font-medium text-gray-600 transition-colors hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400"
			>
				Terms & Conditions
			</a>
		</div>
	</div>
</section>
