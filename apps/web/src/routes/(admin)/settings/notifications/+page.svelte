<script lang="ts">
	import { resolve } from '$app/paths';
	import { updateNotifications } from '$lib/remotes/notifications.remote';
	import AlertTriangle from '~icons/lucide/alert-triangle';
import Bell from '~icons/lucide/bell';
import Mail from '~icons/lucide/mail';
// ...
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';
	import { Switch } from '$lib/components/ui/switch';

	let { data } = $props();

	let isSubmitting = $state(false);

	// Form state - use derived for initial values
	let emailEnabled = $state(false);
	let pushEnabled = $state(false);

	const hasVerifiedEmail = (value: unknown): boolean => {
		if (!value || typeof value !== 'object') return false;
		if (!('emailVerified' in value)) return false;

		return value.emailVerified === true;
	};

	// Initialize from data on mount
	$effect(() => {
		emailEnabled = data.preferences?.emailNotificationsEnabled ?? false;
		pushEnabled = data.preferences?.pushNotificationsEnabled ?? false;
	});

	// Track if user can enable push (requires email verification)
	// Check both preferences from server load and user data from parent layout
	let canEnablePush = $derived(
		data.preferences?.emailVerified === true || 
		hasVerifiedEmail(data.user)
	);

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
		<Card.Root class="border border-amber-100 bg-amber-50/50 dark:border-amber-900/30 dark:bg-amber-950/10 shadow-none">
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
		<input type="hidden" name="emailNotificationsEnabled" value={emailEnabled ? 'true' : 'false'} />
		<input type="hidden" name="pushNotificationsEnabled" value={pushEnabled ? 'true' : 'false'} />
		<Card.Root class="border-0 bg-white dark:bg-zinc-900 shadow-[0_4px_12px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.2)] rounded-lg">
			<Card.Content class="space-y-6 pt-6">
				<!-- Email Notifications -->
				<div class="flex items-center justify-between">
					<div class="flex items-start gap-3">
						<div
							class="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-350"
						>
							<Mail class="h-4.5 w-4.5" />
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
							class="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-350"
						>
							<Bell class="h-4.5 w-4.5" />
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

			</Card.Content>

			<Card.Footer class="border-t border-zinc-100 dark:border-zinc-800 pt-6">
				<Button type="submit" disabled={isSubmitting}>
					{isSubmitting ? 'Saving...' : 'Save Preferences'}
				</Button>
			</Card.Footer>
		</Card.Root>
	</form>
</div>
