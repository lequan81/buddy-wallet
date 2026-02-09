<script lang="ts">
	import { page } from '$app/state';
	import { enhance } from '$app/forms';
	import { Button, buttonVariants } from '@repo/ui/components/ui/button';
	import * as DropdownMenu from '@repo/ui/components/ui/dropdown-menu';
	import * as Avatar from '@repo/ui/components/ui/avatar';
	import PushPermissionBanner from '$lib/components/shared/PushPermissionBanner.svelte';
	import {
		Wallet,
		LayoutDashboard,
		Users,
		FileText,
		Settings,
		LogOut,
		User,
		Shield,
		Menu,
		X,
		Activity,
		Bell
	} from '@lucide/svelte';
	import { cn } from '$lib/utils';

	let { children, data } = $props();
	let user = $derived(data.user);
	let permissions = $derived(data.permissions);
	let sidebarOpen = $state(false);
	let isLoggingOut = $state(false);

	// Build nav items based on server-computed permissions
	const navItems = $derived(() => {
		const items = [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }];

		if (permissions.canManageUsers) {
			items.push({ href: '/dashboard/users', label: 'Users', icon: Users });
		}

		if (permissions.canImportData) {
			items.push({ href: '/dashboard/import', label: 'Import', icon: FileText });
		}

		return items;
	});

	const settingsItems = [
		{ href: '/settings/profile', label: 'Profile', icon: User },
		{ href: '/settings/security', label: 'Security', icon: Shield },
		{ href: '/settings/notifications', label: 'Notifications', icon: Bell },
		{ href: '/settings/activity', label: 'Activity', icon: Activity },
		{ href: '/settings/banks', label: 'Banks', icon: Wallet }
	];
</script>

<div class="flex min-h-dvh bg-muted/30">
	<!-- Desktop Sidebar -->
	<aside class="hidden border-r bg-background lg:fixed lg:inset-y-0 lg:flex lg:w-56 lg:flex-col">
		<!-- Logo -->
		<div class="flex h-14 items-center border-b px-4">
			<a href="/" class="flex items-center space-x-2">
				<Wallet class="h-5 w-5 text-muted-foreground" />
				<span class="font-semibold">Buddy Wallet</span>
			</a>
		</div>

		<!-- Navigation -->
		<nav class="flex-1 space-y-1 px-3 py-4">
			{#each navItems() as item}
				<a
					href={item.href}
					class={cn(
						'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
						page.url.pathname === item.href || page.url.pathname.startsWith(item.href + '/')
							? 'bg-muted text-foreground'
							: 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
					)}
				>
					<item.icon class="h-4 w-4" />
					{item.label}
				</a>
			{/each}

			<div class="pt-4">
				<p class="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
					Settings
				</p>
				{#each settingsItems as item}
					<a
						href={item.href}
						class={cn(
							'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
							page.url.pathname === item.href
								? 'bg-muted text-foreground'
								: 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
						)}
					>
						<item.icon class="h-4 w-4" />
						{item.label}
					</a>
				{/each}
			</div>
		</nav>

		<!-- User -->
		<div class="border-t p-4">
			<div class="flex items-center gap-3">
				<Avatar.Root class="h-9 w-9">
					<Avatar.Fallback class="text-xs"
						>{user?.email?.[0]?.toUpperCase() || 'U'}</Avatar.Fallback
					>
				</Avatar.Root>
				<div class="flex-1 truncate">
					<p class="truncate text-sm font-medium">{user?.email}</p>
					<p class="text-xs capitalize text-muted-foreground">{user?.role}</p>
				</div>
			</div>
		</div>
	</aside>

	<!-- Mobile sidebar -->
	{#if sidebarOpen}
		<div class="fixed inset-0 z-50 lg:hidden">
			<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions a11y_interactive_supports_focus -->
			<div
				class="fixed inset-0 bg-black/50"
				role="button"
				tabindex="-1"
				onclick={() => (sidebarOpen = false)}
			></div>
			<aside class="fixed inset-y-0 left-0 w-64 border-r bg-background">
				<div class="flex h-14 items-center justify-between border-b px-4">
					<a href="/" class="flex items-center space-x-2">
						<Wallet class="h-5 w-5 text-muted-foreground" />
						<span class="font-semibold">Buddy Wallet</span>
					</a>
					<button onclick={() => (sidebarOpen = false)} class="rounded p-1 hover:bg-muted">
						<X class="h-5 w-5" />
					</button>
				</div>
				<nav class="flex-1 space-y-1 px-3 py-4">
					{#each navItems() as item}
						<a
							href={item.href}
							onclick={() => (sidebarOpen = false)}
							class={cn(
								'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
								page.url.pathname === item.href
									? 'bg-muted text-foreground'
									: 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
							)}
						>
							<item.icon class="h-4 w-4" />
							{item.label}
						</a>
					{/each}

					<div class="pt-4">
						<p
							class="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
						>
							Settings
						</p>
						{#each settingsItems as item}
							<a
								href={item.href}
								onclick={() => (sidebarOpen = false)}
								class={cn(
									'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
									page.url.pathname === item.href
										? 'bg-muted text-foreground'
										: 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
								)}
							>
								<item.icon class="h-4 w-4" />
								{item.label}
							</a>
						{/each}
					</div>
				</nav>
			</aside>
		</div>
	{/if}

	<!-- Main content -->
	<div class="flex flex-1 flex-col lg:pl-56">
		<!-- Top header -->
		<header class="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background px-4">
			<button onclick={() => (sidebarOpen = true)} class="rounded p-2 hover:bg-muted lg:hidden">
				<Menu class="h-5 w-5" />
			</button>

			<div class="flex-1"></div>

			<!-- User dropdown -->
			<DropdownMenu.Root>
				<DropdownMenu.Trigger
					class="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted"
				>
					<Avatar.Root class="h-7 w-7">
						<Avatar.Fallback class="text-xs"
							>{user?.email?.[0]?.toUpperCase() || 'U'}</Avatar.Fallback
						>
					</Avatar.Root>
					<span class="hidden font-medium sm:block">{user?.email}</span>
				</DropdownMenu.Trigger>
				<DropdownMenu.Content align="end" class="w-56">
					<DropdownMenu.Label>
						<div class="flex flex-col">
							<span class="font-medium">{user?.email}</span>
							<span class="text-xs capitalize text-muted-foreground">{user?.role}</span>
						</div>
					</DropdownMenu.Label>
					<DropdownMenu.Separator />
					<DropdownMenu.Item>
						{#snippet child({ props }: { props: Record<string, any> })}
							<a href="/settings/profile" {...props} class="flex w-full items-center">
								<User class="mr-2 h-4 w-4 text-muted-foreground" />
								Profile
							</a>
						{/snippet}
					</DropdownMenu.Item>
					<DropdownMenu.Item>
						{#snippet child({ props }: { props: Record<string, any> })}
							<a href="/settings/security" {...props} class="flex w-full items-center">
								<Shield class="mr-2 h-4 w-4 text-muted-foreground" />
								Security
							</a>
						{/snippet}
					</DropdownMenu.Item>
					<DropdownMenu.Item>
						{#snippet child({ props }: { props: Record<string, any> })}
							<a href="/settings/activity" {...props} class="flex w-full items-center">
								<Activity class="mr-2 h-4 w-4 text-muted-foreground" />
								Activity
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
							{#snippet child({ props }: { props: Record<string, any> })}
								<button type="submit" {...props} class="flex w-full items-center text-destructive">
									<LogOut class="mr-2 h-4 w-4" />
									{isLoggingOut ? 'Logging out...' : 'Log out'}
								</button>
							{/snippet}
						</DropdownMenu.Item>
					</form>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		</header>

		<!-- Page content -->
		<main class="flex-1 p-4 lg:p-6">
			{@render children()}
		</main>
	</div>

	<!-- Push notification permission banner -->
	<PushPermissionBanner />
</div>
