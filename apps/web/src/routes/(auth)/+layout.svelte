<script>
	import { page } from '$app/state';
	// @ts-ignore
	import IconLucideWallet from '~icons/lucide/wallet';

	let { children } = $props();
</script>

<div
	class="flex min-h-dvh flex-col items-center justify-center bg-linear-to-br from-slate-50 via-blue-50 to-indigo-50 p-4 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900"
>
	<!-- Logo -->
	<a href="/" class="mb-8 flex items-center space-x-2 text-foreground">
		<IconLucideWallet class="h-8 w-8 text-primary" />
		<span class="text-2xl font-bold">Buddy Wallet</span>
	</a>

	<!-- Content -->
	<div class="w-full max-w-md">
		{@render children()}
	</div>

	<!-- Footer -->
	<p class="mt-8 text-center text-sm text-muted-foreground">
		<a
			href="/terms"
			data-sveltekit-preload-data="hover"
			class="transition-colors hover:text-foreground">Terms</a
		>
		<span class="mx-2">•</span>
		<a
			href="/privacy"
			data-sveltekit-preload-data="hover"
			class="transition-colors hover:text-foreground">Privacy</a
		>
	</p>
</div>
