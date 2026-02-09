<script lang="ts">
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { Button } from '@repo/ui/components/ui/button';
	import { Label } from '@repo/ui/components/ui/label';
	import * as Card from '@repo/ui/components/ui/card';
	import { Separator } from '@repo/ui/components/ui/separator';
	import * as AlertDialog from '@repo/ui/components/ui/alert-dialog';
	import { Badge } from '@repo/ui/components/ui/badge';
	import {
		Monitor,
		Smartphone,
		Tablet,
		MapPin,
		Clock,
		Shield,
		LogOut,
		AlertTriangle,
		Key,
		Bell,
		BellOff
	} from '@lucide/svelte';
	import {
		pushState,
		initializePushState,
		subscribeToPush,
		unsubscribeFromPush,
		sendTestNotification,
		isPushSupported
	} from '$lib/push.svelte';
	import FormInput from '$lib/components/forms/FormInput.svelte';

	let { data, form } = $props();

	// Toast on form results
	$effect(() => {
		if (form?.success) {
			toast.success(form.message || 'Action completed successfully');
		} else if (form?.message && !form?.success) {
			toast.error(form.message);
		}
	});

	let isRevoking = $state<string | null>(null);
	let isLoggingOutAll = $state(false);
	let showLogoutAllDialog = $state(false);
	let isChangingPassword = $state(false);
	let isTogglingPush = $state(false);
	let isSendingTest = $state(false);
	let pushSupported = $state(false);

	// Password form state
	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');

	// Validation state
	type ValidationState = 'default' | 'success' | 'error' | 'warning';
	let newPasswordValidation = $state<ValidationState>('default');
	let newPasswordMessage = $state('');
	let confirmPasswordValidation = $state<ValidationState>('default');
	let confirmPasswordMessage = $state('');

	// Password strength checker
	$effect(() => {
		if (newPassword === '') {
			newPasswordValidation = 'default';
			newPasswordMessage = '';
			return;
		}

		const hasMinLength = newPassword.length >= 8;
		const hasUpperCase = /[A-Z]/.test(newPassword);
		const hasLowerCase = /[a-z]/.test(newPassword);
		const hasNumber = /\d/.test(newPassword);
		const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);

		const requirementsMet = [
			hasMinLength,
			hasUpperCase,
			hasLowerCase,
			hasNumber,
			hasSpecialChar
		].filter(Boolean).length;

		if (!hasMinLength) {
			newPasswordValidation = 'error';
			newPasswordMessage = 'Password must be at least 8 characters';
			return;
		}

		if (requirementsMet < 3) {
			newPasswordValidation = 'error';
			newPasswordMessage = 'Include uppercase, lowercase, numbers, and special characters';
			return;
		}

		if (requirementsMet === 3) {
			newPasswordValidation = 'warning';
			newPasswordMessage = 'Password strength: Medium';
			return;
		}

		newPasswordValidation = 'success';
		newPasswordMessage = 'Password strength: Strong';
	});

	// Confirm password validation
	$effect(() => {
		if (confirmPassword === '') {
			confirmPasswordValidation = 'default';
			confirmPasswordMessage = '';
			return;
		}

		if (confirmPassword !== newPassword) {
			confirmPasswordValidation = 'error';
			confirmPasswordMessage = 'Passwords do not match';
			return;
		}

		confirmPasswordValidation = 'success';
		confirmPasswordMessage = 'Passwords match';
	});

	onMount(async () => {
		pushSupported = isPushSupported();
		if (pushSupported) {
			await initializePushState();
		}
	});

	async function handleTogglePush() {
		isTogglingPush = true;
		if (pushState.isSubscribed) {
			await unsubscribeFromPush();
		} else {
			await subscribeToPush();
		}
		isTogglingPush = false;
	}

	async function handleTestNotification() {
		isSendingTest = true;
		await sendTestNotification();
		isSendingTest = false;
	}

	// Format date to relative time
	function formatRelativeTime(dateStr: string | null): string {
		if (!dateStr) return 'Unknown';
		const date = new Date(dateStr);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return 'Just now';
		if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
		if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
		if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
		return date.toLocaleDateString();
	}

	// Get device icon based on type
	function getDeviceIcon(deviceType: string | null) {
		switch (deviceType?.toLowerCase()) {
			case 'mobile':
				return Smartphone;
			case 'tablet':
				return Tablet;
			default:
				return Monitor;
		}
	}
</script>

<div class="space-y-6">
	<div>
		<h3 class="text-lg font-medium">Security</h3>
		<p class="text-sm text-muted-foreground">Manage your active sessions and security settings.</p>
	</div>
	<Separator />

	{#if form?.success}
		<div
			class="rounded-md bg-green-50 p-4 text-sm text-green-600 dark:bg-green-950 dark:text-green-400"
		>
			{form.message || 'Action completed successfully'}
		</div>
	{:else if form?.message}
		<div class="rounded-md bg-red-50 p-4 text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
			{form.message}
		</div>
	{/if}

	{#if data.error}
		<div
			class="rounded-md bg-yellow-50 p-4 text-sm text-yellow-600 dark:bg-yellow-950 dark:text-yellow-400"
		>
			<AlertTriangle class="mr-2 inline-block h-4 w-4" />
			Failed to load sessions: {data.error}
		</div>
	{/if}

	<!-- Active Sessions -->
	<Card.Root>
		<Card.Header>
			<div class="flex items-center justify-between">
				<div>
					<Card.Title class="flex items-center gap-2">
						<Shield class="h-5 w-5" />
						Active Sessions
					</Card.Title>
					<Card.Description>
						Devices where you're currently logged in. You can log out from any session.
					</Card.Description>
				</div>
				{#if data.sessions.length >= 1}
					<AlertDialog.Root bind:open={showLogoutAllDialog}>
						<AlertDialog.Trigger>
							{#snippet child({ props }: { props: Record<string, any> })}
								<Button variant="destructive" size="sm" {...props}>
									<LogOut class="mr-2 h-4 w-4" />
									Logout All Devices
								</Button>
							{/snippet}
						</AlertDialog.Trigger>
						<AlertDialog.Content>
							<AlertDialog.Header>
								<AlertDialog.Title>Logout from all devices?</AlertDialog.Title>
								<AlertDialog.Description>
									This will log you out from all devices, including this one. You'll need to log in
									again.
								</AlertDialog.Description>
							</AlertDialog.Header>
							<AlertDialog.Footer>
								<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
								<form
									method="POST"
									action="?/logoutAll"
									use:enhance={() => {
										isLoggingOutAll = true;
										return async ({ update }) => {
											isLoggingOutAll = false;
											showLogoutAllDialog = false;
											await update();
										};
									}}
								>
									<Button type="submit" variant="destructive" disabled={isLoggingOutAll}>
										{#if isLoggingOutAll}
											Logging out...
										{:else}
											Yes, logout all
										{/if}
									</Button>
								</form>
							</AlertDialog.Footer>
						</AlertDialog.Content>
					</AlertDialog.Root>
				{/if}
			</div>
		</Card.Header>
		<Card.Content class="space-y-4">
			{#if data.sessions.length === 0}
				<p class="py-8 text-center text-sm text-muted-foreground">No active sessions found.</p>
			{:else}
				{#each data.sessions as session (session.id)}
					{@const DeviceIcon = getDeviceIcon(session.deviceType)}
					{@const isCurrent = session.id === data.currentSessionId}
					<div
						class="flex items-start justify-between rounded-lg border p-4 {isCurrent
							? 'border-primary bg-primary/5'
							: ''}"
					>
						<div class="flex gap-4">
							<div class="mt-1">
								<DeviceIcon class="h-8 w-8 text-muted-foreground" />
							</div>
							<div class="space-y-1">
								<div class="flex items-center gap-2">
									<span class="font-medium">
										{#if session.deviceName && session.deviceName !== 'Unknown' && !session.deviceName.includes('Unknown on Unknown')}
											{session.deviceName}
										{:else if session.deviceType}
											{session.deviceType.charAt(0).toUpperCase() + session.deviceType.slice(1)} Device
										{:else}
											Web Browser
										{/if}
									</span>
									{#if isCurrent}
										<Badge variant="default" class="text-xs">Current</Badge>
									{/if}
								</div>
								{#if session.location && session.location !== 'Unknown'}
									<div class="flex items-center gap-1 text-sm text-muted-foreground">
										<MapPin class="h-3 w-3" />
										{session.location}
									</div>
								{/if}
								<div class="flex items-center gap-1 text-sm text-muted-foreground">
									<Clock class="h-3 w-3" />
									{#if isCurrent}
										Active now
									{:else}
										Last active: {formatRelativeTime(session.lastActiveAt)}
									{/if}
								</div>
								<div class="text-xs text-muted-foreground">
									Signed in: {new Date(session.createdAt).toLocaleDateString()}
								</div>
							</div>
						</div>
						{#if !isCurrent}
							<form
								method="POST"
								action="?/revokeSession"
								use:enhance={() => {
									isRevoking = session.id;
									return async ({ update }) => {
										isRevoking = null;
										await update();
									};
								}}
							>
								<input type="hidden" name="sessionId" value={session.id} />
								<Button
									type="submit"
									variant="ghost"
									size="sm"
									disabled={isRevoking === session.id}
								>
									{#if isRevoking === session.id}
										Revoking...
									{:else}
										<LogOut class="h-4 w-4" />
									{/if}
								</Button>
							</form>
						{/if}
					</div>
				{/each}
			{/if}
		</Card.Content>
	</Card.Root>

	<!-- Push Notifications -->
	{#if pushSupported}
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2">
					{#if pushState.isSubscribed}
						<Bell class="h-5 w-5 text-primary" />
					{:else}
						<BellOff class="h-5 w-5" />
					{/if}
					Push Notifications
				</Card.Title>
				<Card.Description>
					Receive notifications about debt reminders, payment updates, and important alerts.
				</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="flex items-center justify-between">
					<div class="space-y-1">
						<p class="font-medium">
							{#if pushState.isSubscribed}
								Notifications enabled
							{:else if pushState.permission === 'denied'}
								Notifications blocked
							{:else}
								Notifications disabled
							{/if}
						</p>
						<p class="text-sm text-muted-foreground">
							{#if pushState.isSubscribed}
								You'll receive push notifications on this device.
							{:else if pushState.permission === 'denied'}
								You've blocked notifications. Enable them in your browser settings.
							{:else}
								Enable to receive push notifications on this device.
							{/if}
						</p>
					</div>
					<div class="flex gap-2">
						{#if pushState.isSubscribed}
							<Button
								variant="outline"
								size="sm"
								onclick={handleTestNotification}
								disabled={isSendingTest}
							>
								{#if isSendingTest}
									Sending...
								{:else}
									Test
								{/if}
							</Button>
						{/if}
						<Button
							variant={pushState.isSubscribed ? 'destructive' : 'default'}
							size="sm"
							onclick={handleTogglePush}
							disabled={isTogglingPush || pushState.permission === 'denied'}
						>
							{#if isTogglingPush}
								{pushState.isSubscribed ? 'Disabling...' : 'Enabling...'}
							{:else if pushState.isSubscribed}
								Disable
							{:else}
								Enable
							{/if}
						</Button>
					</div>
				</div>

				{#if pushState.error}
					<div
						class="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950 dark:text-red-400"
					>
						{pushState.error}
					</div>
				{/if}
			</Card.Content>
		</Card.Root>
	{/if}

	<!-- Security Tips -->
	<Card.Root>
		<Card.Header>
			<Card.Title>Security Tips</Card.Title>
		</Card.Header>
		<Card.Content class="space-y-3 text-sm text-muted-foreground">
			<p>• Review your active sessions regularly and revoke any you don't recognize.</p>
			<p>• If you see a session from an unfamiliar location, change your password immediately.</p>
			<p>• Use "Logout All Devices" after changing your password for maximum security.</p>
			<p>• Your session will automatically expire after 90 days of inactivity.</p>
		</Card.Content>
	</Card.Root>

	<!-- Change Password -->
	<Card.Root>
		<Card.Header>
			<Card.Title class="flex items-center gap-2">
				<Key class="h-5 w-5" />
				Change Password
			</Card.Title>
			<Card.Description>
				Update your password. This will log out all other devices for security.
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<form
				method="POST"
				action="?/changePassword"
				class="space-y-4"
				use:enhance={() => {
					isChangingPassword = true;
					return async ({ update }) => {
						isChangingPassword = false;
						await update();
					};
				}}
			>
				<FormInput
					id="currentPassword"
					name="currentPassword"
					label="Current Password"
					type="password"
					bind:value={currentPassword}
					showPasswordToggle
					autocomplete="current-password"
					required
				/>

				<FormInput
					id="newPassword"
					name="newPassword"
					label="New Password"
					type="password"
					bind:value={newPassword}
					showPasswordToggle
					autocomplete="new-password"
					validationState={newPasswordValidation}
					error={newPasswordValidation === 'error' ? newPasswordMessage : undefined}
					success={newPasswordValidation === 'success' ? newPasswordMessage : undefined}
					warning={newPasswordValidation === 'warning' ? newPasswordMessage : undefined}
					helpText="Minimum 8 characters with uppercase, lowercase, numbers, and special characters"
					required
				/>

				<FormInput
					id="confirmPassword"
					name="confirmPassword"
					label="Confirm New Password"
					type="password"
					bind:value={confirmPassword}
					showPasswordToggle
					autocomplete="new-password"
					validationState={confirmPasswordValidation}
					error={confirmPasswordValidation === 'error' ? confirmPasswordMessage : undefined}
					success={confirmPasswordValidation === 'success' ? confirmPasswordMessage : undefined}
					required
				/>

				<Button
					type="submit"
					disabled={isChangingPassword ||
						currentPassword === '' ||
						newPasswordValidation === 'error' ||
						confirmPasswordValidation === 'error' ||
						newPassword === '' ||
						confirmPassword === ''}
				>
					{#if isChangingPassword}
						Changing...
					{:else}
						Change Password
					{/if}
				</Button>
			</form>
		</Card.Content>
	</Card.Root>
</div>
