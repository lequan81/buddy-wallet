<script lang="ts">
	import { resolve } from '$app/paths';
	import LayoutDashboard from '~icons/lucide/layout-dashboard';
import LogOut from '~icons/lucide/log-out';
import Menu from '~icons/lucide/menu';
import User from '~icons/lucide/user';
import Wallet from '~icons/lucide/wallet';
	import { page } from '$app/state';
	import { enhance } from '$app/forms';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import * as Sheet from '$lib/components/ui/sheet';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import * as Avatar from '$lib/components/ui/avatar';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import { cn } from '$lib/utils';

	let user = $derived(page.data.user);
	let isLoggingOut = $state(false);
</script>

<header class="sticky top-0 z-50 w-full border-b bg-background">
	<div class="container flex h-14 items-center">
		<!-- Logo -->
		<div class="mr-4 hidden md:flex">
			<a href={resolve(`/`, {})} class="flex items-center space-x-2">
				<Wallet class="h-5 w-5 text-muted-foreground" />
				<span class="font-bold">Buddy Wallet</span>
			</a>
		</div>

		<!-- Mobile Menu -->
		<Sheet.Root>
			<Sheet.Trigger class={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'md:hidden')}>
				<Menu class="h-5 w-5" />
				<span class="sr-only">Toggle Menu</span>
			</Sheet.Trigger>
			<Sheet.Content side="left">
				<div class="mb-6">
					<a href={resolve(`/`, {})} class="flex items-center space-x-2">
						<Wallet class="h-5 w-5 text-muted-foreground" />
						<span class="font-bold">Buddy Wallet</span>
					</a>
				</div>
				<nav class="flex flex-col space-y-3">
					{#if user}
						<a
							href={resolve(`/dashboard`, {})}
							class="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
						>
							<LayoutDashboard class="h-4 w-4" />
							Dashboard
						</a>
					{:else}
						<a
							href={resolve(`/`, {})}
							class="text-sm text-muted-foreground transition-colors hover:text-foreground"
						>
							Home
						</a>
					{/if}
				</nav>
			</Sheet.Content>
		</Sheet.Root>

		<!-- Mobile logo -->
		<a href={resolve(`/`, {})} class="flex items-center space-x-2 md:hidden">
			<Wallet class="h-5 w-5 text-muted-foreground" />
			<span class="font-bold">Buddy Wallet</span>
		</a>

		<!-- Right side -->
		<div class="ml-auto flex items-center gap-2">
			<ThemeToggle />

			{#if user}
				<DropdownMenu.Root>
					<DropdownMenu.Trigger class={cn(buttonVariants({ variant: 'ghost', size: 'icon' }))}>
						<Avatar.Root class="h-8 w-8">
							<Avatar.Fallback class="text-xs"
								>{user?.email?.[0]?.toUpperCase() || 'U'}</Avatar.Fallback
							>
						</Avatar.Root>
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="end" class="w-56">
						<DropdownMenu.Label class="font-normal">
							<div class="flex flex-col space-y-1">
								<p class="text-sm leading-none font-medium">{user?.email ?? ''}</p>
								<p class="text-xs leading-none text-muted-foreground capitalize">{user?.role ?? ''}</p>
							</div>
						</DropdownMenu.Label>
						<DropdownMenu.Separator />
						<DropdownMenu.Item>
							{#snippet child({ props }: { props: Record<string, unknown> })}
								<a href={resolve(`/dashboard`, {})} {...props} class="flex w-full items-center">
									<LayoutDashboard class="mr-2 h-4 w-4 text-muted-foreground" />
									Dashboard
								</a>
							{/snippet}
						</DropdownMenu.Item>
						<DropdownMenu.Item>
							{#snippet child({ props }: { props: Record<string, unknown> })}
								<a href={resolve(`/settings/profile`, {})} {...props} class="flex w-full items-center">
									<User class="mr-2 h-4 w-4 text-muted-foreground" />
									Settings
								</a>
							{/snippet}
						</DropdownMenu.Item>
						<DropdownMenu.Separator />
						<form
							method="POST"
							action="/logout"
							use:enhance={() => {
								isLoggingOut = true;
								return async ({ update }) => {
									await update();
									isLoggingOut = false;
								};
							}}
						>
							<DropdownMenu.Item disabled={isLoggingOut}>
								{#snippet child({ props }: { props: Record<string, unknown> })}
									<button
										type="submit"
										{...props}
										class="flex w-full items-center text-destructive"
									>
										<LogOut class="mr-2 h-4 w-4" />
										{isLoggingOut ? 'Logging out...' : 'Log out'}
									</button>
								{/snippet}
							</DropdownMenu.Item>
						</form>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			{:else}
				<Button href={resolve(`/login`, {})} variant="ghost" size="sm">Login</Button>
				<Button href={resolve(`/signup`, {})} size="sm">Sign Up</Button>
			{/if}
		</div>
	</div>
</header>
