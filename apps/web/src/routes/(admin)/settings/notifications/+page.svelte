<script lang="ts">
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import { Button } from '@repo/ui/components/ui/button';
	import { Label } from '@repo/ui/components/ui/label';
	import * as Card from '@repo/ui/components/ui/card';
	import { Separator } from '@repo/ui/components/ui/separator';

	let { data, form } = $props();

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

	// Show toast on form result
	$effect(() => {
		if (form?.success) {
			toast.success('Notification preferences updated');
		}
		if (form?.message && !form?.success) {
			toast.error(form.message);
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
				<IconLucideAlertTriangle class="h-5 w-5 text-amber-600 dark:text-amber-400" />
				<div>
					<p class="font-medium text-amber-800 dark:text-amber-200">Email verification required</p>
					<p class="mt-1 text-sm text-amber-700 dark:text-amber-300">
						Verify your email address to enable push notifications. Go to
						<a href="/settings/profile" class="underline">Profile Settings</a> to verify.
					</p>
				</div>
			</Card.Content>
		</Card.Root>
	{/if}

	<form
		method="POST"
		use:enhance={() => {
			isSubmitting = true;
			return async ({ update }) => {
				isSubmitting = false;
				await update();
			};
		}}
	>
		<Card.Root>
			<Card.Content class="space-y-6 pt-6">
				<!-- Email Notifications -->
				<div class="flex items-center justify-between">
					<div class="flex items-start gap-3">
						<div
							class="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30"
						>
							<IconLucideMail class="h-5 w-5 text-blue-600 dark:text-blue-400" />
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
					<label class="relative inline-flex cursor-pointer items-center">
						<input
							type="checkbox"
							id="emailNotifications"
							class="peer sr-only"
							bind:checked={emailEnabled}
						/>
						<div
							class="h-6 w-11 rounded-full bg-input peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-background after:transition-all peer-checked:after:translate-x-5"
						></div>
					</label>
				</div>

				<Separator />

				<!-- Push Notifications -->
				<div class="flex items-center justify-between">
					<div class="flex items-start gap-3">
						<div
							class="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30"
						>
							<IconLucideBell class="h-5 w-5 text-purple-600 dark:text-purple-400" />
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
					<label class="relative inline-flex cursor-pointer items-center">
						<input
							type="checkbox"
							id="pushNotifications"
							class="peer sr-only"
							checked={pushEnabled}
							onchange={handlePushToggle}
							disabled={!canEnablePush}
						/>
						<div
							class="h-6 w-11 rounded-full bg-input peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-background after:transition-all peer-checked:after:translate-x-5"
						></div>
					</label>
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
