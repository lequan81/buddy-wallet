<script lang="ts">
	import { page } from '$app/state';
	import { goto, invalidateAll } from '$app/navigation';
	import { buttonVariants } from '$lib/components/ui/button';
	import * as Sheet from '$lib/components/ui/sheet';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import * as Avatar from '$lib/components/ui/avatar';
	import { Menu, User, Settings, LogOut, Wallet, ShieldAlert } from '@lucide/svelte';
	import { API_URL } from '$lib/api';

	let user = $derived(page.data.user);
	let isLoggingOut = $state(false);

	async function handleLogout() {
		if (isLoggingOut) return;
		isLoggingOut = true;

		try {
			// Call backend API directly - cookies are sent automatically
			await fetch(`${API_URL}/v1/auth/logout`, {
				method: 'POST',
				credentials: 'include' // Send cookies cross-origin
			});
		} catch (error) {
			console.error('[AUTH] Logout error:', error);
		}

		// Always redirect regardless of response (backend clears cookies)
		await invalidateAll();
		await goto('/login?reason=logout', { replaceState: true });
		isLoggingOut = false;
	}
</script>

<header
	class="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60"
>
	<div class="container flex h-14 items-center">
		<div class="mr-4 hidden md:flex">
			<a href="/" class="mr-6 flex items-center space-x-2">
				<Wallet class="h-6 w-6" />
				<span class="hidden font-bold sm:inline-block">Buddy Wallet</span>
			</a>
			<nav class="flex items-center space-x-6 text-sm font-medium">
				<a href="/" class="text-foreground/60 transition-colors hover:text-foreground/80">Home</a>
				{#if user?.permissions?.includes('admin:view')}
					<a href="/admin" class="text-foreground/60 transition-colors hover:text-foreground/80"
						>Admin</a
					>
				{/if}
			</nav>
		</div>

		<!-- Mobile Menu -->
		<Sheet.Root>
			<Sheet.Trigger
				class={buttonVariants({ variant: 'ghost', size: 'icon', className: 'md:hidden' })}
			>
				<Menu class="h-5 w-5" />
				<span class="sr-only">Toggle Menu</span>
			</Sheet.Trigger>
			<Sheet.Content side="left" class="pr-0">
				<div class="px-7">
					<a href="/" class="flex items-center space-x-2">
						<Wallet class="h-6 w-6" />
						<span class="font-bold">Buddy Wallet</span>
					</a>
				</div>
				<div class="my-4 h-[calc(100vh-8rem)] pb-10 pl-6">
					<div class="flex flex-col space-y-3">
						<a href="/" class="text-foreground/70 transition-colors hover:text-foreground">Home</a>
						<a href="/dashboard" class="text-foreground/70 transition-colors hover:text-foreground"
							>Dashboard</a
						>
					</div>
				</div>
			</Sheet.Content>
		</Sheet.Root>

		<div class="flex flex-1 items-center justify-end space-x-2">
			{#if user}
				<DropdownMenu.Root>
					<DropdownMenu.Trigger
						class={buttonVariants({
							variant: 'ghost',
							size: 'icon',
							className: 'relative h-8 w-8 rounded-full'
						})}
					>
						<Avatar.Root class="h-8 w-8">
							<Avatar.Image src="" alt={user.email} />
							<Avatar.Fallback>{user.email[0].toUpperCase()}</Avatar.Fallback>
						</Avatar.Root>
					</DropdownMenu.Trigger>
					<DropdownMenu.Content class="w-56" align="end">
						<DropdownMenu.Label class="font-normal">
							<div class="flex flex-col space-y-1">
								<p class="text-sm leading-none font-medium">{user.email}</p>
								<p class="text-xs leading-none text-muted-foreground">{user.role}</p>
							</div>
						</DropdownMenu.Label>
						<DropdownMenu.Separator />
						<DropdownMenu.Group>
							<DropdownMenu.Item>
								{#snippet child({ props })}
									<a href="/dashboard" {...props} class="flex w-full items-center">
										<ShieldAlert class="mr-2 h-4 w-4" />
										<span>Dashboard</span>
									</a>
								{/snippet}
							</DropdownMenu.Item>
							<DropdownMenu.Item>
								{#snippet child({ props })}
									<a href="/settings/profile" {...props} class="flex w-full items-center">
										<User class="mr-2 h-4 w-4" />
										<span>Profile & Settings</span>
									</a>
								{/snippet}
							</DropdownMenu.Item>
							<DropdownMenu.Item>
								{#snippet child({ props })}
									<a href="/settings/security" {...props} class="flex w-full items-center">
										<ShieldAlert class="mr-2 h-4 w-4" />
										<span>Security</span>
									</a>
								{/snippet}
							</DropdownMenu.Item>
						</DropdownMenu.Group>
						<DropdownMenu.Separator />
						<DropdownMenu.Item onclick={handleLogout} disabled={isLoggingOut}>
							<LogOut class="mr-2 h-4 w-4" />
							<span>{isLoggingOut ? 'Logging out...' : 'Log out'}</span>
						</DropdownMenu.Item>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			{:else}
				<nav class="flex items-center space-x-2">
					<a href="/login" class={buttonVariants({ variant: 'ghost' })}>Login</a>
					<a href="/signup" class={buttonVariants({ variant: 'default' })}>Sign Up</a>
				</nav>
			{/if}
		</div>
	</div>
</header>
