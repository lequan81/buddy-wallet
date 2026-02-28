<script lang="ts">
	import { page } from '$app/state';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/ui/components/ui/card';
	import { Button } from '@repo/ui/components/ui/button';
	import { AlertTriangle, Clock, Mail } from '@lucide/svelte';

	const lockoutUntil = $derived(page.url.searchParams.get('until'));
	const email = $derived(page.url.searchParams.get('email'));

	const isTemporary = $derived(lockoutUntil && new Date(lockoutUntil) > new Date());

	const formattedUnlockTime = $derived(() => {
		if (!lockoutUntil) return '';
		const date = new Date(lockoutUntil);
		return date.toLocaleString();
	});

	const timeRemaining = $derived(() => {
		if (!lockoutUntil) return '';
		const until = new Date(lockoutUntil).getTime();
		const now = Date.now();
		const diff = until - now;
		if (diff <= 0) return '';
		const minutes = Math.ceil(diff / 60000);
		return minutes < 60 ? `${minutes} minutes` : `${Math.ceil(minutes / 60)} hours`;
	});
</script>

<div class="container flex min-h-[80vh] items-center justify-center py-10">
	<Card class="w-full max-w-md">
		<CardHeader class="text-center">
			<div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
				{#if isTemporary}
					<Clock class="h-8 w-8 text-destructive" />
				{:else}
					<AlertTriangle class="h-8 w-8 text-destructive" />
				{/if}
			</div>
			<CardTitle class="text-2xl">
				{#if isTemporary}
					Account Temporarily Locked
				{:else}
					Account Locked
				{/if}
			</CardTitle>
			<CardDescription class="mt-2">
				{#if isTemporary}
					Your account has been temporarily locked due to multiple failed login attempts.
				{:else}
					Your account has been locked by an administrator.
				{/if}
			</CardDescription>
		</CardHeader>
		<CardContent class="space-y-4">
			{#if isTemporary}
				<div class="rounded-lg bg-muted p-4 text-center">
					<p class="text-sm text-muted-foreground">Your account will unlock in:</p>
					<p class="mt-1 text-lg font-semibold">{timeRemaining()}</p>
					<p class="mt-1 text-xs text-muted-foreground">({formattedUnlockTime()})</p>
				</div>
				<p class="text-center text-sm text-muted-foreground">
					For security reasons, please wait until the lockout period expires before attempting to log in again.
				</p>
			{:else}
				<div class="rounded-lg bg-destructive/10 p-4">
					<p class="text-sm text-destructive">
						Your account has been permanently locked. Please contact support to resolve this issue.
					</p>
				</div>
				{#if email}
					<div class="flex items-center justify-center gap-2 text-sm text-muted-foreground">
						<Mail class="h-4 w-4" />
						<span>Account: {email}</span>
					</div>
				{/if}
			{/if}

			<div class="flex flex-col gap-2 pt-4">
				<Button href="/login" variant="outline" class="w-full">
					Return to Login
				</Button>
				{#if !isTemporary}
					<Button href="mailto:support@buddywallet.app" class="w-full">
						Contact Support
					</Button>
				{/if}
			</div>
		</CardContent>
	</Card>
</div>
