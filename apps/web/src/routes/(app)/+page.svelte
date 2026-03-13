<script lang="ts">
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import { Button } from '@repo/ui/components/ui/button';
	import * as Card from '@repo/ui/components/ui/card';
	import { Skeleton } from '@repo/ui/components/ui/skeleton';
	import FormInput from '$lib/components/forms/FormInput.svelte';
	import { cn } from '$lib/utils';

	import { Phone, Loader2, Users, FileCheck, Lock, Zap } from '@repo/icons';

	let { data, form } = $props();
	let isLoggedIn = $derived(!!data.user);

	let phoneNumber = $state('');
	let checking = $state(false);

	let result = $derived.by(() => {
		if (form?.success && form?.result) {
			return form.result as { success: boolean; phone: string; found: boolean; count: number };
		}
		return null;
	});

	let error = $derived.by(() => {
		if (form?.error) return form.error as string;
		return '';
	});

	type ValidationState = 'default' | 'success' | 'error' | 'warning';
	let validationState: ValidationState = $derived.by(() => {
		if (error) return 'error';
		if (result) return 'success';
		return 'default';
	});
</script>

<svelte:head>
	<title>Buddy Wallet - Precise Expense Sharing</title>
	<meta name="description" content="Financial-grade debt tracking and settlement application" />
</svelte:head>

{#snippet debtCheckerCard()}
	<Card.Root class="mx-auto mt-12 max-w-md border-border/50 bg-background/50 shadow-sm backdrop-blur-sm transition-all hover:shadow-md">
		<Card.Header>
			<Card.Title class="text-center text-xl font-medium tracking-tight">Check Your Debt Status</Card.Title>
			<Card.Description class="text-center text-sm">
				Enter your phone number to see if you have any pending debts
			</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-5">
			<form
				method="POST"
				action="?/checkDebt"
				use:enhance={() => {
					checking = true;
					return async ({ update }) => {
						checking = false;
						await update();
					};
				}}
			>
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
				type="submit"
				disabled={checking || phoneNumber.length < 9}
				class="mt-5 w-full font-medium"
				size="lg"
			>
				{#if checking}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" />
					Checking Ledgers...
				{:else}
					Check Status
				{/if}
			</Button>
			</form>

			{#if checking}
				<div class="mt-4 space-y-3 rounded-lg border border-border/50 p-4">
					<Skeleton class="h-4 w-3/4" />
					<Skeleton class="h-10 w-full" />
				</div>
			{:else if result}
				<div
					class={cn(
						'mt-4 rounded-lg border p-5 transition-all duration-300 animate-in fade-in slide-in-from-bottom-2',
						result.found ? 'border-destructive/20 bg-destructive/5' : 'border-emerald-500/20 bg-emerald-500/5'
					)}
				>
					{#if result.found}
						<p class="mb-3 text-center text-sm font-medium text-destructive">
							You have <span class="text-lg font-bold">{result.count}</span> pending debt{result.count !== 1 ? 's' : ''}
						</p>
						<Button
							href="/login"
							data-sveltekit-preload-data="hover"
							variant="destructive"
							class="w-full shadow-sm">View Details</Button
						>
					{:else}
						<p class="mb-3 text-center text-sm font-medium text-emerald-600 dark:text-emerald-400">
							Record is clean. No pending debts found.
						</p>
						<Button
							href="/signup"
							data-sveltekit-preload-data="hover"
							variant="outline"
							class="w-full border-emerald-500/20 hover:bg-emerald-500/10 hover:text-emerald-700 dark:hover:text-emerald-300">Create Account</Button
						>
					{/if}
				</div>
			{/if}
		</Card.Content>
	</Card.Root>
{/snippet}

{#snippet featuresSection()}
	<section class="border-t border-border/40 bg-muted/20 px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
		<div class="mx-auto max-w-5xl">
			<div class="mb-14 text-center">
				<h2 class="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
					Financial-Grade Precision
				</h2>
				<p class="mt-3 text-base text-muted-foreground">
					Everything you need to track, manage, and settle debts with complete transparency.
				</p>
			</div>

			<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
				<div class="rounded-xl border border-border/50 bg-card p-6 shadow-sm transition-all hover:shadow-md">
					<div class="mb-5 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
						<Users class="h-5 w-5 text-primary" />
					</div>
					<h3 class="mb-2 text-base font-medium text-card-foreground">Seamless Tracking</h3>
					<p class="text-sm leading-relaxed text-muted-foreground">
						Record transactions instantly with just a phone number and amount.
					</p>
				</div>

				<div class="rounded-xl border border-border/50 bg-card p-6 shadow-sm transition-all hover:shadow-md">
					<div class="mb-5 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
						<FileCheck class="h-5 w-5 text-primary" />
					</div>
					<h3 class="mb-2 text-base font-medium text-card-foreground">Clear Ledgers</h3>
					<p class="text-sm leading-relaxed text-muted-foreground">
						View exact balances and full historical records at a glance.
					</p>
				</div>

				<div class="rounded-xl border border-border/50 bg-card p-6 shadow-sm transition-all hover:shadow-md">
					<div class="mb-5 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
						<Lock class="h-5 w-5 text-primary" />
					</div>
					<h3 class="mb-2 text-base font-medium text-card-foreground">Verified Privacy</h3>
					<p class="text-sm leading-relaxed text-muted-foreground">
						Financial records are strictly protected with role-based access.
					</p>
				</div>

				<div class="rounded-xl border border-border/50 bg-card p-6 shadow-sm transition-all hover:shadow-md">
					<div class="mb-5 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
						<Zap class="h-5 w-5 text-primary" />
					</div>
					<h3 class="mb-2 text-base font-medium text-card-foreground">Instant Settlement</h3>
					<p class="text-sm leading-relaxed text-muted-foreground">
						Resolve obligations quickly with built-in proof of payment uploads.
					</p>
				</div>
			</div>
		</div>
	</section>
{/snippet}

<!-- Hero Section -->
<section class="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
	<div class="mx-auto max-w-4xl">
		<div class="text-center">
			<h1 class="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
				Expense Sharing, <span class="text-primary">Simplified.</span>
			</h1>
			<p class="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground leading-relaxed">
				Keep your finances clear and relationships healthy with Buddy Wallet.
			</p>
		</div>

		{#if !isLoggedIn}
			{@render debtCheckerCard()}
			<div class="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
				<Button onclick={() => goto('/signup')} size="lg" class="shadow-sm font-medium">Get Started</Button>
				<Button onclick={() => goto('/login')} variant="outline" size="lg" class="font-medium bg-background">Sign In</Button>
			</div>
		{:else}
			<div class="mx-auto mt-12 max-w-md text-center">
				<div class="rounded-xl border border-border/50 bg-card p-8 shadow-sm">
					<p class="mb-6 text-base font-medium text-card-foreground">Welcome back to your ledger.</p>
					<div class="flex flex-col gap-3 sm:flex-row sm:justify-center">
						<Button onclick={() => goto('/dashboard')} size="lg" class="shadow-sm">Go to Dashboard</Button>
						<Button onclick={() => goto('/debts/create')} variant="outline" size="lg" class="bg-background">Create Record</Button>
					</div>
				</div>
			</div>
		{/if}
	</div>
</section>

{@render featuresSection()}

<section class="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
	<div class="mx-auto max-w-2xl text-center">
		<h2 class="text-2xl font-semibold text-foreground sm:text-3xl tracking-tight">Ready to clear the books?</h2>
		<p class="mt-4 text-base text-muted-foreground">
			Join users who trust Buddy Wallet for precise debt management.
		</p>
		<div class="mt-8">
			<Button onclick={() => goto('/signup')} size="lg" class="shadow-sm font-medium px-8">Create Free Account</Button>
		</div>
	</div>
</section>

<section class="border-t border-border/50 bg-muted/10 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
	<div class="mx-auto max-w-5xl">
		<div class="flex flex-wrap justify-center gap-x-8 gap-y-4 text-sm">
			<a href="/about" class="font-medium text-muted-foreground transition-colors hover:text-foreground">
				About Us
			</a>
			<a href="/faq" class="font-medium text-muted-foreground transition-colors hover:text-foreground">
				FAQ
			</a>
			<a href="/terms" class="font-medium text-muted-foreground transition-colors hover:text-foreground">
				Terms & Conditions
			</a>
		</div>
	</div>
</section>
