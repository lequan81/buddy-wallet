<script lang="ts">
	import { resolve } from '$app/paths';
	import { updateNotifications } from '$lib/remotes/notifications.remote';
	import { AlertTriangle, Bell, Mail } from '@repo/icons';
// ...
	import { toast } from 'svelte-sonner';
	import { Button } from '@repo/ui/components/ui/button';
	import { Label } from '@repo/ui/components/ui/label';
	import * as Card from '@repo/ui/components/ui/card';
	import { Separator } from '@repo/ui/components/ui/separator';
	import { Switch } from '@repo/ui/components/ui/switch';

	let { data } = $props();

	let isSubmitting = $state(false);

	// Form state - use derived for initial values
	let emailEnabled = $state(false);
	let pushEnabled = $state(false);

	// Initialize from data on mount
	$effect(() => {
		emailEnabled = data.preferences?.emailNotificationsEnabled ?? false;
		pushEnabled = data.preferences?.pushNotificationsEnabled ?? false;
	});

	// Track if user can enable push (requires email verification)
	let canEnablePush = $derived(data.preferences?.emailVerified === true);

	// DEBUG: $inspect is auto-stripped in production builds
	$inspect(data.preferences, canEnablePush);

	// Show toast on form result
	$effect(() => {
		if (updateNotifications.result?.success) {
			toast.success('Notification preferences updated');
		}
		const issues = updateNotifications.fields.allIssues();
		if (issues && issues.length > 0) {
			toast.error(issues[0].message);
		}
	});

	// Prevent enabling push if email not verified
	function handlePushToggle(event: Event) {
		const target = event.target as HTMLInputElement;
		if (target.checked && !canEnablePush) {
			event.preventDefault();
			target.checked = false;
			toast.error('Please verify your email first to enable push notifications');
			return;
		}
		pushEnabled = target.checked;
	}
</script>

<div class="space-y-6">
	<div>
		<h3 class="text-lg font-medium">Notifications</h3>
		<p class="text-sm text-muted-foreground">
			Configure how you want to receive notifications about your debts.
		</p>
	</div>
	<Separator />

	{#if !canEnablePush}
		<Card.Root class="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20">
			<Card.Content class="flex items-start gap-3 pt-6">
				<AlertTriangle class="h-5 w-5 text-amber-600 dark:text-amber-400" />
				<div>
					<p class="font-medium text-amber-800 dark:text-amber-200">Email verification required</p>
					<p class="mt-1 text-sm text-amber-700 dark:text-amber-300">
						Verify your email address to enable push notifications. Go to
						<a href={resolve(`/settings/profile`, {})} class="underline">Profile Settings</a> to verify.
					</p>
				</div>
			</Card.Content>
		</Card.Root>
	{/if}

	<form
		{...updateNotifications.enhance(async ({ submit }) => {
			isSubmitting = true;
			try {
				await submit();
			} finally {
				isSubmitting = false;
			}
		})}
	>
		<Card.Root>
			<Card.Content class="space-y-6 pt-6">
				<!-- Email Notifications -->
				<div class="flex items-center justify-between">
					<div class="flex items-start gap-3">
						<div
							class="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30"
						>
							<Mail class="h-5 w-5 text-blue-600 dark:text-blue-400" />
						</div>
						<div class="space-y-1">
							<Label for="emailNotifications" class="text-base font-medium">
								Email Notifications
							</Label>
							<p class="text-sm text-muted-foreground">
								Receive email alerts for new debts, confirmations, and payments.
							</p>
						</div>
					</div>
					<Switch
						bind:checked={emailEnabled}
						disabled={!canEnablePush}
						aria-label="Toggle email notifications"
					/>
				</div>

				<Separator />

				<!-- Push Notifications -->
				<div class="flex items-center justify-between">
					<div class="flex items-start gap-3">
						<div
							class="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30"
						>
							<Bell class="h-5 w-5 text-purple-600 dark:text-purple-400" />
						</div>
						<div class="space-y-1">
							<Label for="pushNotifications" class="text-base font-medium">
								Push Notifications
							</Label>
							<p class="text-sm text-muted-foreground">
								Get instant browser notifications for important updates.
								{#if !canEnablePush}
									<span class="text-amber-600 dark:text-amber-400">
										(Requires email verification)
									</span>
								{/if}
							</p>
						</div>
					</div>
					<Switch
						checked={pushEnabled}
						onCheckedChange={(v: boolean) => {
							if (v && !canEnablePush) {
								toast.error('Please verify your email first to enable push notifications');
								return;
							}
							pushEnabled = v;
						}}
						disabled={!canEnablePush}
						aria-label="Toggle push notifications"
					/>
				</div>

				<!-- Hidden inputs for form submission -->
				<input
					type="hidden"
					name="emailNotificationsEnabled"
					value={emailEnabled ? 'true' : 'false'}
				/>
				<input
					type="hidden"
					name="pushNotificationsEnabled"
					value={pushEnabled ? 'true' : 'false'}
				/>
			</Card.Content>

			<Card.Footer class="border-t pt-6">
				<Button type="submit" disabled={isSubmitting}>
					{isSubmitting ? 'Saving...' : 'Save Preferences'}
				</Button>
			</Card.Footer>
		</Card.Root>
	</form>
</div>
