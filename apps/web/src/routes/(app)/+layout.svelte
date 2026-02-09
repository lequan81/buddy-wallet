<script lang="ts">
	import { page } from '$app/state';
	import { Wallet, Menu, X } from '@lucide/svelte';
	import { Button, buttonVariants } from '@repo/ui/components/ui/button';
	import * as Sheet from '@repo/ui/components/ui/sheet';
	import { cn } from '$lib/utils';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';

	let { children } = $props();
	let user = $derived(page.data.user);
	let isMobileMenuOpen = $state(false);

	const navLinks = [
		{ href: '/', label: 'Home' },
		{ href: '/about', label: 'About' },
		{ href: '/faq', label: 'FAQ' }
	];
</script>

<!-- Marketing Header -->
<header
	class="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md supports-backdrop-filter:bg-background/60"
>
	<div class="container flex h-16 items-center justify-between px-4 md:px-6">
		<a href="/" class="flex items-center space-x-2 transition-opacity hover:opacity-90">
			<Wallet class="h-6 w-6 text-primary" />
			<span class="text-xl font-bold tracking-tight">Buddy Wallet</span>
		</a>

		<!-- Desktop Navigation -->
		<nav class="hidden items-center space-x-8 text-sm font-medium md:flex">
			{#each navLinks as link}
				<a
					href={link.href}
					class="text-muted-foreground transition-colors hover:text-foreground/80"
				>
					{link.label}
				</a>
			{/each}
		</nav>

		<!-- Desktop Actions -->
		<div class="hidden items-center gap-4 md:flex">
			<div class="flex items-center gap-1 border-r pr-4 dark:border-gray-800">
				<LanguageSwitcher />
				<ThemeToggle />
			</div>

			<div class="flex items-center gap-2">
				{#if user}
					<a href="/dashboard" class={buttonVariants({ variant: 'default', size: 'sm' })}>
						Dashboard
					</a>
				{:else}
					<a href="/login" class={buttonVariants({ variant: 'ghost', size: 'sm' })}>Login</a>
					<a href="/signup" class={buttonVariants({ variant: 'default', size: 'sm' })}>Sign Up</a>
				{/if}
			</div>
		</div>

		<!-- Mobile Menu Trigger -->
		<div class="flex items-center gap-2 md:hidden">
			<ThemeToggle />
			<Sheet.Root bind:open={isMobileMenuOpen}>
				<Sheet.Trigger>
					{#snippet child({ props }: { props: Record<string, unknown> })}
						<Button variant="ghost" size="icon" {...props}>
							<Menu class="h-5 w-5" />
							<span class="sr-only">Toggle menu</span>
						</Button>
					{/snippet}
				</Sheet.Trigger>
				<Sheet.Content side="right" class="w-75 sm:w-87.5">
					<Sheet.Header class="text-left">
						<Sheet.Title>
							<a
								href="/"
								class="flex items-center space-x-2"
								onclick={() => (isMobileMenuOpen = false)}
							>
								<Wallet class="h-6 w-6 text-primary" />
								<span class="font-bold">Buddy Wallet</span>
							</a>
						</Sheet.Title>
						<Sheet.Description>Manage shared expenses easily.</Sheet.Description>
					</Sheet.Header>

					<div class="mt-8 flex flex-col gap-6">
						<nav class="flex flex-col gap-4">
							{#each navLinks as link}
								<a
									href={link.href}
									class="text-lg font-medium text-foreground/80 transition-colors hover:text-primary"
									onclick={() => (isMobileMenuOpen = false)}
								>
									{link.label}
								</a>
							{/each}
						</nav>

						<div class="flex flex-col gap-4 border-t pt-6 dark:border-gray-800">
							<div class="flex items-center justify-between">
								<span class="text-sm font-medium text-muted-foreground">Language</span>
								<LanguageSwitcher />
							</div>

							<div class="flex flex-col gap-3">
								{#if user}
									<a
										href="/dashboard"
										class={buttonVariants({ variant: 'default', size: 'lg', class: 'w-full' })}
										onclick={() => (isMobileMenuOpen = false)}
									>
										Dashboard
									</a>
								{:else}
									<a
										href="/login"
										class={buttonVariants({ variant: 'outline', size: 'lg', class: 'w-full' })}
										onclick={() => (isMobileMenuOpen = false)}
									>
										Log In
									</a>
									<a
										href="/signup"
										class={buttonVariants({
											variant: 'default',
											size: 'lg',
											class: 'w-full shadow-lg shadow-primary/20'
										})}
										onclick={() => (isMobileMenuOpen = false)}
									>
										Sign Up
									</a>
								{/if}
							</div>
						</div>
					</div>
				</Sheet.Content>
			</Sheet.Root>
		</div>
	</div>
</header>

<!-- Main Content -->
<main class="flex-1">
	{@render children()}
</main>

<!-- Footer -->
<footer class="border-t bg-background">
	<div class="container px-4 py-12 md:px-6">
		<div class="grid gap-8 sm:grid-cols-2 md:grid-cols-4">
			<div class="space-y-4">
				<div class="flex items-center space-x-2">
					<Wallet class="h-6 w-6 text-primary" />
					<span class="font-bold">Buddy Wallet</span>
				</div>
				<p class="max-w-xs text-sm text-muted-foreground">
					The easiest way to split expenses and manage shared debts with friends and roommates.
				</p>
			</div>

			<div class="space-y-4">
				<h4 class="text-sm font-semibold tracking-wider text-foreground/90 uppercase">Product</h4>
				<ul class="space-y-2 text-sm text-muted-foreground">
					<li><a href="/" class="transition-colors hover:text-primary">Home</a></li>
					<li><a href="/features" class="transition-colors hover:text-primary">Features</a></li>
					<li><a href="/pricing" class="transition-colors hover:text-primary">Pricing</a></li>
				</ul>
			</div>

			<div class="space-y-4">
				<h4 class="text-sm font-semibold tracking-wider text-foreground/90 uppercase">Resources</h4>
				<ul class="space-y-2 text-sm text-muted-foreground">
					<li><a href="/about" class="transition-colors hover:text-primary">About Us</a></li>
					<li><a href="/faq" class="transition-colors hover:text-primary">Help Center</a></li>
					<li><a href="/blog" class="transition-colors hover:text-primary">Blog</a></li>
				</ul>
			</div>

			<div class="space-y-4">
				<h4 class="text-sm font-semibold tracking-wider text-foreground/90 uppercase">Legal</h4>
				<ul class="space-y-2 text-sm text-muted-foreground">
					<li><a href="/privacy" class="transition-colors hover:text-primary">Privacy</a></li>
					<li><a href="/terms" class="transition-colors hover:text-primary">Terms</a></li>
					<li><a href="/security" class="transition-colors hover:text-primary">Security</a></li>
				</ul>
			</div>
		</div>
		<div class="mt-12 border-t pt-8 text-center text-sm text-muted-foreground">
			<p>&copy; {new Date().getFullYear()} Buddy Wallet. Built with ❤️ for the community.</p>
		</div>
	</div>
</footer>
