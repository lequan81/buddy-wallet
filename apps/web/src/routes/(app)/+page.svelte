<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '@repo/ui/components/ui/button';
	import { ArrowRight, CheckCircle2, Shield, Zap, Globe, Users, BarChart3 } from '@lucide/svelte';
</script>

<svelte:head>
	<title>Buddy Wallet - Split Expenses Smart</title>
</svelte:head>

<!-- Hero Section -->
<section class="relative overflow-hidden pt-24 pb-12 lg:pt-32 lg:pb-20">
	<div class="container px-4 md:px-6">
		<div class="mx-auto max-w-4xl text-center">
			<h1
				class="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl"
			>
				Split Expenses, <br />
				<span class="text-primary">Build Harmony</span>
			</h1>
			<p class="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
				The easiest way to track shared expenses, settle debts, and maintain financial transparency
				with friends, roommates, and groups.
			</p>
			<div class="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
				<Button size="lg" onclick={() => goto('/signup')} class="h-14 gap-2 px-8 text-lg">
					Get Started
					<ArrowRight class="h-5 w-5" />
				</Button>
				<Button
					variant="outline"
					size="lg"
					onclick={() => goto('/about')}
					class="h-14 px-8 text-lg"
				>
					Learn More
				</Button>
			</div>
		</div>
	</div>

	<!-- Decorator -->
	<div
		class="absolute top-0 left-1/2 -z-10 h-150 w-150 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[100px]"
	></div>
</section>

<!-- Stats / Social Proof (Preline Style) -->
<section class="border-y bg-muted/30 py-12">
	<div class="container px-4 md:px-6">
		<div class="grid grid-cols-2 gap-8 text-center md:grid-cols-4">
			<div class="space-y-2">
				<h3 class="text-3xl font-bold text-foreground">10k+</h3>
				<p class="text-sm text-muted-foreground">Active Users</p>
			</div>
			<div class="space-y-2">
				<h3 class="text-3xl font-bold text-foreground">$5M+</h3>
				<p class="text-sm text-muted-foreground">Expenses Tracked</p>
			</div>
			<div class="space-y-2">
				<h3 class="text-3xl font-bold text-foreground">99.9%</h3>
				<p class="text-sm text-muted-foreground">Uptime</p>
			</div>
			<div class="space-y-2">
				<h3 class="text-3xl font-bold text-foreground">24/7</h3>
				<p class="text-sm text-muted-foreground">Support</p>
			</div>
		</div>
	</div>
</section>

<!-- Features Section -->
<section class="py-20 lg:py-32">
	<div class="container px-4 md:px-6">
		<div class="mx-auto mb-16 max-w-2xl text-center">
			<h2 class="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
				Everything you need to manage shared costs
			</h2>
			<p class="mt-4 text-lg text-muted-foreground">
				Simple, powerful tools designed to make money matters less awkward and more organized.
			</p>
		</div>

		<div class="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
			<!-- Feature 1 -->
			<div
				class="group rounded-2xl border bg-card p-8 shadow-sm transition-all hover:border-primary/20 hover:shadow-md"
			>
				<div
					class="mb-4 inline-flex items-center justify-center rounded-lg bg-primary/10 p-3 text-primary"
				>
					<Users class="h-6 w-6" />
				</div>
				<h3 class="mb-2 text-xl font-semibold text-foreground">Group Management</h3>
				<p class="text-muted-foreground">
					Create groups for trips, households, or events. Add members and start splitting in
					seconds.
				</p>
			</div>

			<!-- Feature 2 -->
			<div
				class="group rounded-2xl border bg-card p-8 shadow-sm transition-all hover:border-primary/20 hover:shadow-md"
			>
				<div
					class="mb-4 inline-flex items-center justify-center rounded-lg bg-primary/10 p-3 text-primary"
				>
					<BarChart3 class="h-6 w-6" />
				</div>
				<h3 class="mb-2 text-xl font-semibold text-foreground">Smart Analytics</h3>
				<p class="text-muted-foreground">
					Visualize spending trends. See who spends the most and categorize expenses automatically.
				</p>
			</div>

			<!-- Feature 3 -->
			<div
				class="group rounded-2xl border bg-card p-8 shadow-sm transition-all hover:border-primary/20 hover:shadow-md"
			>
				<div
					class="mb-4 inline-flex items-center justify-center rounded-lg bg-primary/10 p-3 text-primary"
				>
					<Globe class="h-6 w-6" />
				</div>
				<h3 class="mb-2 text-xl font-semibold text-foreground">Multi-currency</h3>
				<p class="text-muted-foreground">
					Traveling abroad? We handle exchange rates automatically for seamless international
					splitting.
				</p>
			</div>

			<!-- Feature 4 -->
			<div
				class="group rounded-2xl border bg-card p-8 shadow-sm transition-all hover:border-primary/20 hover:shadow-md"
			>
				<div
					class="mb-4 inline-flex items-center justify-center rounded-lg bg-primary/10 p-3 text-primary"
				>
					<Zap class="h-6 w-6" />
				</div>
				<h3 class="mb-2 text-xl font-semibold text-foreground">Instant Settlement</h3>
				<p class="text-muted-foreground">
					Record payments instantly. Integrate with payment apps to settle debts with a single
					click.
				</p>
			</div>

			<!-- Feature 5 -->
			<div
				class="group rounded-2xl border bg-card p-8 shadow-sm transition-all hover:border-primary/20 hover:shadow-md"
			>
				<div
					class="mb-4 inline-flex items-center justify-center rounded-lg bg-primary/10 p-3 text-primary"
				>
					<Shield class="h-6 w-6" />
				</div>
				<h3 class="mb-2 text-xl font-semibold text-foreground">Secure & Private</h3>
				<p class="text-muted-foreground">
					Bank-grade encryption keeps your financial data safe. We prioritize your privacy above
					all.
				</p>
			</div>

			<!-- Feature 6 -->
			<div
				class="group rounded-2xl border bg-card p-8 shadow-sm transition-all hover:border-primary/20 hover:shadow-md"
			>
				<div
					class="mb-4 inline-flex items-center justify-center rounded-lg bg-primary/10 p-3 text-primary"
				>
					<CheckCircle2 class="h-6 w-6" />
				</div>
				<h3 class="mb-2 text-xl font-semibold text-foreground">Offline Support</h3>
				<p class="text-muted-foreground">
					No internet? No problem. Add expenses offline and we'll sync everything when you're back
					online.
				</p>
			</div>
		</div>
	</div>
</section>

<!-- CTA Section -->
<section class="border-t bg-muted/50 py-20 lg:py-32">
	<div class="container px-4 md:px-6">
		<div class="mx-auto max-w-3xl text-center">
			<h2 class="mb-6 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
				Ready to simplify your shared expenses?
			</h2>
			<p class="mb-10 text-xl text-muted-foreground">
				Join thousands of users who are already enjoying stress-free bill splitting.
			</p>
			<Button
				size="lg"
				onclick={() => goto('/signup')}
				class="h-14 gap-2 px-10 text-lg shadow-xl shadow-primary/20"
			>
				Create Free Account
			</Button>
			<p class="mt-4 text-sm text-muted-foreground">
				No credit card required. Free forever for small groups.
			</p>
		</div>
	</div>
</section>
