<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { enhance } from '$app/forms';
	import { preloadData } from '$app/navigation';
	import { onMount, type Snippet } from 'svelte';
	
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import * as Avatar from '$lib/components/ui/avatar';
	import * as Sheet from '$lib/components/ui/sheet';
	import { Button } from '$lib/components/ui/button';
	
	import PushPermissionBanner from '$lib/components/shared/PushPermissionBanner.svelte';
	import PwaInstall from '$lib/components/PwaInstall.svelte';
	import { cn } from '$lib/utils';
	import { getCookie, setCookie } from '$lib/utils/cookie-utils';

	// Icons
	import LayoutDashboard from '~icons/lucide/layout-dashboard';
import Server from '~icons/lucide/server';
import Activity from '~icons/lucide/activity';
import Users from '~icons/lucide/users';
import FileText from '~icons/lucide/file-text';
import UserIcon from '~icons/lucide/user';
import Shield from '~icons/lucide/shield';
import Bell from '~icons/lucide/bell';
import Wallet from '~icons/lucide/wallet';
import Menu from '~icons/lucide/menu';
import LogOut from '~icons/lucide/log-out';
import X from '~icons/lucide/x';

	let { children, data } = $props<{ children: Snippet; data: Record<string, unknown> }>();
	
	let user = $derived(data.user ?? null);
	let permissions = $derived(data.permissions ?? null);
	
	let displayName = $derived(user?.name || user?.email || user?.phoneNumber || 'User');
	let avatarInitial = $derived(
		(user?.name?.[0] || user?.email?.[0] || user?.phoneNumber?.[0] || 'U').toUpperCase()
	);
	
	let sidebarOpen = $state(false);
	let isLoggingOut = $state(false);
	let bannerDismissed = $state(true); // Start true to avoid flash

	const showVerificationBanner = $derived(user && user.emailVerified === false && !bannerDismissed);

	onMount(() => {
		bannerDismissed = getCookie('bw-email-banner-dismissed') === 'true';
	});

	onMount(() => {
		const preloadPages = () => {
			const pagesToPreload = ['/settings/profile', '/settings/security'];
			if (permissions?.canImportData) {
				pagesToPreload.push(resolve(`/dashboard/import`, {}));
			}
			Promise.all(pagesToPreload.map((path) => preloadData(path).catch(() => {})));
		};

		if ('requestIdleCallback' in window) {
			requestIdleCallback(preloadPages, { timeout: 3000 });
		} else {
			setTimeout(preloadPages, 500);
		}
	});

	const navItems = $derived(() => {
		const items = [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }];

		if (permissions?.isAdmin) {
			items.push({ href: '/admin/system', label: 'System', icon: Server });
			items.push({ href: '/admin/traces', label: 'Traces', icon: Activity });
			items.push({ href: '/admin/users', label: 'Users', icon: Users });
		}

		if (permissions?.canImportData) {
			items.push({ href: '/dashboard/import', label: 'Import', icon: FileText });
		}

		return items;
	});

	const settingsItems = [
		{ href: '/settings/profile', label: 'Profile', icon: UserIcon },
		{ href: '/settings/security', label: 'Security', icon: Shield },
		{ href: '/settings/notifications', label: 'Notifications', icon: Bell },
		{ href: '/settings/activity', label: 'Activity', icon: Activity },
		{ href: '/settings/banks', label: 'Banks', icon: Wallet }
	];

	function handleNavigate() {
		sidebarOpen = false;
	}
</script>

{#snippet navigationLinks()}
	<nav class="flex-1 space-y-1 py-4">
		{#each navItems() as item}
			<a
				href={item.href}
				onclick={handleNavigate}
				data-sveltekit-preload-data="hover"
				class={cn(
					'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
					$state.eager(page.url.pathname) === item.href
						? 'bg-secondary text-secondary-foreground font-semibold'
						: 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
				)}
			>
				<item.icon class="h-[18px] w-[18px]" />
				{item.label}
			</a>
		{/each}

		<div class="pt-6">
			<p class="mb-2 px-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase opacity-70">
				Settings
			</p>
			{#each settingsItems as item}
				<a
					href={item.href}
					onclick={handleNavigate}
					data-sveltekit-preload-data="hover"
					class={cn(
						'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
						$state.eager(page.url.pathname) === item.href
							? 'bg-secondary text-secondary-foreground font-semibold'
							: 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
					)}
				>
					<item.icon class="h-[18px] w-[18px]" />
					{item.label}
				</a>
			{/each}
		</div>
	</nav>
{/snippet}

<div class="flex min-h-dvh bg-muted/20">
	<!-- Desktop Sidebar -->
	<aside class="hidden border-r border-border/60 bg-background lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
		<div class="flex h-16 items-center border-b border-border/60 px-6">
			<a href={resolve(`/`, {})} class="flex items-center space-x-2.5 transition-opacity hover:opacity-90">
				<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
					<Wallet class="h-5 w-5 text-primary" />
				</div>
				<span class="text-lg font-semibold tracking-tight">Buddy Wallet</span>
			</a>
		</div>

		<div class="flex-1 px-4 overflow-y-auto">
			{@render navigationLinks()}
		</div>

		<!-- User Section -->
		<div class="border-t border-border/60 p-4">
			<div class="flex items-center gap-3 rounded-xl border border-transparent p-2 transition-colors hover:bg-secondary/50">
				<Avatar.Root class="h-9 w-9 border border-border/50 shadow-sm">
					<Avatar.Fallback class="text-xs bg-muted font-medium">{avatarInitial}</Avatar.Fallback>
				</Avatar.Root>
				<div class="flex-1 overflow-hidden">
					<p class="truncate text-sm font-medium leading-none">{displayName}</p>
					<p class="mt-1 truncate text-xs text-muted-foreground capitalize">{user?.role}</p>
				</div>
			</div>
		</div>
	</aside>

	<!-- Mobile Sidebar (Sheet) -->
	<Sheet.Root bind:open={sidebarOpen}>
		<Sheet.Content side="left" class="w-72 p-0 flex flex-col">
			<Sheet.Header class="h-16 border-b border-border/60 px-6 flex flex-row items-center justify-start text-left">
				<a href={resolve(`/`, {})} class="flex items-center space-x-2.5" onclick={handleNavigate}>
					<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
						<Wallet class="h-5 w-5 text-primary" />
					</div>
					<Sheet.Title class="text-lg font-semibold tracking-tight m-0">Buddy Wallet</Sheet.Title>
				</a>
			</Sheet.Header>
			<div class="flex-1 px-4 overflow-y-auto">
				{@render navigationLinks()}
			</div>
		</Sheet.Content>
	</Sheet.Root>

	<!-- Main Content Wrapper -->
	<div class="flex flex-1 flex-col lg:pl-64">
		<!-- Top header -->
		<header class="sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border/60 bg-background/95 backdrop-blur px-4 sm:px-6">
			<div class="flex items-center">
				<Button 
					variant="ghost" 
					size="icon" 
					class="lg:hidden mr-2 -ml-2" 
					onclick={() => (sidebarOpen = true)}
				>
					<Menu class="h-5 w-5" />
					<span class="sr-only">Toggle Sidebar</span>
				</Button>
			</div>

			<div class="flex items-center gap-3">
				<PwaInstall />

				<DropdownMenu.Root>
					<DropdownMenu.Trigger
						class="flex items-center gap-2 rounded-full border border-border/50 hover:bg-muted/50 p-1 pl-3 pr-1 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary"
					>
						<span class="hidden font-medium sm:block">{displayName}</span>
						<Avatar.Root class="h-8 w-8 shadow-sm">
							<Avatar.Fallback class="text-xs bg-primary/10 text-primary font-medium">{avatarInitial}</Avatar.Fallback>
						</Avatar.Root>
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="end" class="w-60 p-2">
						<DropdownMenu.Label class="px-2 py-1.5">
							<div class="flex flex-col space-y-1">
								<span class="font-medium text-sm leading-none">{displayName}</span>
								<span class="text-xs text-muted-foreground leading-none">{user?.email || user?.phoneNumber}</span>
								<span class="text-xs font-semibold text-primary capitalize mt-1.5">{user?.role}</span>
							</div>
						</DropdownMenu.Label>
						<DropdownMenu.Separator class="my-1" />
						<DropdownMenu.Group>
							<DropdownMenu.Item class="cursor-pointer rounded-md p-2">
								{#snippet child({ props }: { props: Record<string, unknown> })}
									<a href={resolve(`/settings/profile`, {})} {...props} class="flex w-full items-center">
										<UserIcon class="mr-2 h-4 w-4 text-muted-foreground" />
										Profile
									</a>
								{/snippet}
							</DropdownMenu.Item>
							<DropdownMenu.Item class="cursor-pointer rounded-md p-2">
								{#snippet child({ props }: { props: Record<string, unknown> })}
									<a href={resolve(`/settings/security`, {})} {...props} class="flex w-full items-center">
										<Shield class="mr-2 h-4 w-4 text-muted-foreground" />
										Security
									</a>
								{/snippet}
							</DropdownMenu.Item>
							<DropdownMenu.Item class="cursor-pointer rounded-md p-2">
								{#snippet child({ props }: { props: Record<string, unknown> })}
									<a href={resolve(`/settings/activity`, {})} {...props} class="flex w-full items-center">
										<Activity class="mr-2 h-4 w-4 text-muted-foreground" />
										Activity
									</a>
								{/snippet}
							</DropdownMenu.Item>
						</DropdownMenu.Group>
						<DropdownMenu.Separator class="my-1" />
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
							<DropdownMenu.Item disabled={isLoggingOut} class="cursor-pointer rounded-md p-2">
								{#snippet child({ props }: { props: Record<string, unknown> })}
									<button type="submit" {...props} class="flex w-full items-center text-destructive focus:text-destructive focus:bg-destructive/10">
										<LogOut class="mr-2 h-4 w-4" />
										{isLoggingOut ? 'Logging out...' : 'Log out'}
									</button>
								{/snippet}
							</DropdownMenu.Item>
						</form>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</div>
		</header>

		<!-- Email Verification Banner -->
		{#if showVerificationBanner}
			<div
				class="border-b border-warning/30 bg-warning/5 px-4 py-3"
			>
				<div class="flex items-center justify-between gap-4">
					<div class="flex items-center gap-2.5 text-sm text-warning-foreground font-medium">
						<Shield class="h-4 w-4 shrink-0 text-warning" />
						<span>Verify your email to unlock all features</span>
					</div>
					<div class="flex items-center gap-2">
						<a
							href={resolve(`/settings/profile`, {})}
							class="rounded-md bg-warning px-3 py-1 font-medium text-warning-foreground shadow-sm transition-colors hover:bg-warning/90 text-sm"
						>
							Verify Now
						</a>
						<button
							onclick={() => {
								bannerDismissed = true;
								setCookie('bw-email-banner-dismissed', 'true', 30);
							}}
							class="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted"
							aria-label="Dismiss"
						>
							<X class="h-4 w-4" />
						</button>
					</div>
				</div>
			</div>
		{/if}

		<!-- Page content -->
		<main class="flex-1 w-full p-4 sm:p-6 lg:p-8">
			<div class="mx-auto w-full max-w-6xl">
				{@render children()}
			</div>
		</main>
	</div>

	<!-- Push notification permission banner -->
	<PushPermissionBanner />
</div>
