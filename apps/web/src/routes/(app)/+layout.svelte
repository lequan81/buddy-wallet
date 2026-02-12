<script lang="ts">
	import { page } from '$app/state';
	import { Wallet } from '@lucide/svelte';
	import { buttonVariants } from '@repo/ui/components/ui/button';

	let { children } = $props();
	let user = $derived(page.data.user);
</script>

<!-- Marketing Header -->
<header
	class="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60"
>
	<div class="container flex h-14 items-center justify-between">
		<a href="/" class="flex items-center space-x-2">
			<Wallet class="h-6 w-6 text-primary" />
			<span class="text-lg font-bold">Buddy Wallet</span>
		</a>

		<nav class="hidden items-center space-x-6 text-sm font-medium md:flex">
			<a href="/" class="text-foreground/60 transition-colors hover:text-foreground">Home</a>
			<a href="/about" data-sveltekit-preload-data="hover" class="text-foreground/60 transition-colors hover:text-foreground">About</a>
			<a href="/faq" data-sveltekit-preload-data="hover" class="text-foreground/60 transition-colors hover:text-foreground">FAQ</a>
		</nav>

		<div class="flex items-center space-x-2">
			{#if user}
				<a href="/dashboard" data-sveltekit-preload-data="hover" class={buttonVariants({ variant: 'default' })}>Dashboard</a>
			{:else}
				<a href="/login" data-sveltekit-preload-data="hover" class={buttonVariants({ variant: 'ghost' })}>Login</a>
				<a href="/signup" data-sveltekit-preload-data="hover" class={buttonVariants({ variant: 'default' })}>Sign Up</a>
			{/if}
		</div>
	</div>
</header>

<!-- Main Content -->
<main class="flex-1">
	{@render children()}
</main>

<!-- Marketing Footer -->
<footer class="border-t bg-muted/50">
	<div class="container py-12">
		<div class="grid gap-8 md:grid-cols-4">
			<!-- Brand -->
			<div class="space-y-4">
				<div class="flex items-center space-x-2">
					<Wallet class="h-6 w-6 text-primary" />
					<span class="font-bold">Buddy Wallet</span>
				</div>
				<p class="text-sm text-muted-foreground">
					Split expenses smart. Track debts with transparency.
				</p>
			</div>

			<!-- Product -->
			<div class="space-y-4">
				<h4 class="font-semibold">Product</h4>
				<ul class="space-y-2 text-sm text-muted-foreground">
					<li><a href="/" class="transition-colors hover:text-foreground">Home</a></li>
					<li><a href="/about" data-sveltekit-preload-data="hover" class="transition-colors hover:text-foreground">About</a></li>
					<li><a href="/faq" data-sveltekit-preload-data="hover" class="transition-colors hover:text-foreground">FAQ</a></li>
				</ul>
			</div>

			<!-- Legal -->
			<div class="space-y-4">
				<h4 class="font-semibold">Legal</h4>
				<ul class="space-y-2 text-sm text-muted-foreground">
					<li>
						<a href="/terms" data-sveltekit-preload-data="hover" class="transition-colors hover:text-foreground">Terms of Service</a>
					</li>
					<li>
						<a href="/privacy" data-sveltekit-preload-data="hover" class="transition-colors hover:text-foreground">Privacy Policy</a>
					</li>
				</ul>
			</div>

			<!-- Account -->
			<div class="space-y-4">
				<h4 class="font-semibold">Account</h4>
				<ul class="space-y-2 text-sm text-muted-foreground">
					<li><a href="/login" data-sveltekit-preload-data="hover" class="transition-colors hover:text-foreground">Login</a></li>
					<li><a href="/signup" data-sveltekit-preload-data="hover" class="transition-colors hover:text-foreground">Sign Up</a></li>
				</ul>
			</div>
		</div>

		<div class="mt-12 border-t pt-8 text-center text-sm text-muted-foreground">
			<p>&copy; {new Date().getFullYear()} Buddy Wallet. All rights reserved.</p>
		</div>
	</div>
</footer>
