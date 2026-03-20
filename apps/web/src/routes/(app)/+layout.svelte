<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { buttonVariants } from '@repo/ui/components/ui/button';
	import { Wallet } from '@repo/icons';

	let { children } = $props();
	let user = $derived(page.data.user);
</script>

<!-- Marketing Header -->
<header
	class="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 shadow-sm"
>
	<div class="container flex h-16 items-center justify-between">
		<a href={resolve(`/`, {})} class="flex items-center space-x-2.5 transition-opacity hover:opacity-90">
			<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
				<Wallet class="h-5 w-5 text-primary" />
			</div>
			<span class="text-xl font-semibold tracking-tight">Buddy Wallet</span>
		</a>

		<nav class="hidden items-center space-x-8 text-sm font-medium md:flex">
			<a href={resolve(`/`, {})} class="text-muted-foreground transition-colors hover:text-foreground">Home</a>
			<a
				href={resolve(`/about`, {})}
				data-sveltekit-preload-data="hover"
				class="text-muted-foreground transition-colors hover:text-foreground">About</a
			>
			<a
				href={resolve(`/faq`, {})}
				data-sveltekit-preload-data="hover"
				class="text-muted-foreground transition-colors hover:text-foreground">FAQ</a
			>
		</nav>

		<div class="flex items-center space-x-3">
			{#if user}
				<a
					href={resolve(`/dashboard`, {})}
					data-sveltekit-preload-data="hover"
					class={buttonVariants({ variant: 'default', class: 'shadow-sm' })}>Dashboard</a
				>
			{:else}
				<a
					href={resolve(`/login`, {})}
					data-sveltekit-preload-data="hover"
					class={buttonVariants({ variant: 'ghost', class: 'font-medium' })}>Sign In</a
				>
				<a
					href={resolve(`/signup`, {})}
					data-sveltekit-preload-data="hover"
					class={buttonVariants({ variant: 'default', class: 'shadow-sm font-medium' })}>Get Started</a
				>
			{/if}
		</div>
	</div>
</header>

<!-- Main Content -->
<main class="flex-1">
	{@render children()}
</main>

<!-- Marketing Footer -->
<footer class="border-t border-border/50 bg-muted/10">
	<div class="container py-16">
		<div class="grid gap-10 md:grid-cols-4 lg:gap-14">
			<!-- Brand -->
			<div class="space-y-5 lg:col-span-1">
				<a href={resolve(`/`, {})} class="flex items-center space-x-2.5">
					<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
						<Wallet class="h-5 w-5 text-primary" />
					</div>
					<span class="text-xl font-semibold tracking-tight">Buddy Wallet</span>
				</a>
				<p class="text-sm leading-relaxed text-muted-foreground">
					Split expenses smart. Track debts with complete transparency and financial precision.
				</p>
			</div>

			<!-- Product -->
			<div class="space-y-5">
				<h4 class="font-medium tracking-tight">System</h4>
				<ul class="space-y-3 text-sm text-muted-foreground">
					<li><a href={resolve(`/`, {})} class="transition-colors hover:text-foreground">Platform Overview</a></li>
					<li>
						<a
							href={resolve(`/about`, {})}
							data-sveltekit-preload-data="hover"
							class="transition-colors hover:text-foreground">Company</a
						>
					</li>
					<li>
						<a
							href={resolve(`/faq`, {})}
							data-sveltekit-preload-data="hover"
							class="transition-colors hover:text-foreground">Knowledge Base</a
						>
					</li>
				</ul>
			</div>

			<!-- Legal -->
			<div class="space-y-5">
				<h4 class="font-medium tracking-tight">Compliance</h4>
				<ul class="space-y-3 text-sm text-muted-foreground">
					<li>
						<a
							href={resolve(`/terms`, {})}
							data-sveltekit-preload-data="hover"
							class="transition-colors hover:text-foreground">Terms of Service</a
						>
					</li>
					<li>
						<a
							href={resolve(`/privacy`, {})}
							data-sveltekit-preload-data="hover"
							class="transition-colors hover:text-foreground">Privacy Policy</a
						>
					</li>
				</ul>
			</div>

			<!-- Account -->
			<div class="space-y-5">
				<h4 class="font-medium tracking-tight">Access</h4>
				<ul class="space-y-3 text-sm text-muted-foreground">
					<li>
						<a
							href={resolve(`/login`, {})}
							data-sveltekit-preload-data="hover"
							class="transition-colors hover:text-foreground">Sign In</a
						>
					</li>
					<li>
						<a
							href={resolve(`/signup`, {})}
							data-sveltekit-preload-data="hover"
							class="transition-colors hover:text-foreground">Create Account</a
						>
					</li>
				</ul>
			</div>
		</div>

		<div class="mt-16 border-t border-border/50 pt-8 text-center sm:flex sm:items-center sm:justify-between sm:text-left">
			<p class="text-sm text-muted-foreground">&copy; {new Date().getFullYear()} Buddy Wallet. All rights reserved.</p>
			<p class="mt-4 text-xs text-muted-foreground sm:mt-0">Financial-grade expense tracking.</p>
		</div>
	</div>
</footer>
