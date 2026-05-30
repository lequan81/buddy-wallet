<script lang="ts">
	import Phone from '~icons/lucide/phone';
import User from '~icons/lucide/user';
import Pencil from '~icons/lucide/pencil';
	import { updateProfile } from '$lib/remotes/profile.remote';
	import { page } from '$app/state';
	import type { PageData } from './$types';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';
	import FormInput from '$lib/components/forms/FormInput.svelte';
	import { getParam } from '$lib/services/navigation';
	import { ProfileState } from './profile-state.svelte';

	let { data }: { data: PageData } = $props();
	
	const ps = new ProfileState(() => data.user);

	// Sync remote results
	$effect(() => {
		ps.handleUpdateResult();
	});
</script>

<div class="space-y-6">
	<div>
		<h3 class="text-lg font-medium">Profile</h3>
		<p class="text-sm text-muted-foreground">This is how others will see you on the site.</p>
	</div>
	<Separator />

	{#if ps.showSuccess}
		<div class="rounded-lg border border-success/30 bg-success/5 px-4 py-3 text-sm text-success-foreground">
			Profile updated successfully!
		</div>
	{/if}

	{#if getParam(page.url, 'error') === 'missing_phone'}
		<Card.Root class="border border-warning/30 bg-warning/5 shadow-none">
			<Card.Content class="pt-6">
				<p class="font-semibold text-warning">Phone Number Required</p>
				<p class="mt-1 text-sm text-muted-foreground">
					You must add a phone number to your profile before you can create debts.
				</p>
			</Card.Content>
		</Card.Root>
	{/if}

	<form
		{...updateProfile.enhance(async ({ submit }) => {
			ps.isSubmitting = true;
			try {
				await submit();
			} finally {
				ps.isSubmitting = false;
			}
		})}
	>
		<Card.Root class="border-0 bg-white dark:bg-zinc-900 shadow-[0_4px_12px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.2)] rounded-lg">
			<Card.Content class="space-y-6 pt-6">
				<div class="flex items-center gap-4">
					<div class="relative h-16 w-16 overflow-hidden rounded-full bg-muted">
						{#if ps.avatarPreview}
							<img src={ps.avatarPreview} alt="Avatar preview" class="h-full w-full object-cover" />
						{:else}
							<div class="flex h-full w-full items-center justify-center">
								<User class="h-8 w-8 text-muted-foreground" />
							</div>
						{/if}
						{#if ps.loading}
							<div class="absolute inset-0 flex items-center justify-center bg-black/50">
								<div class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
							</div>
						{/if}
					</div>
					<div class="space-y-1.5">
						<Label class="text-sm font-medium">Profile Photo</Label>
						<div class="flex items-center gap-2">
							<Label
								for="avatar-upload"
								class="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 text-xs font-medium transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200"
							>
								<Pencil class="h-3 w-3" />
								Change photo
							</Label>
						</div>
						<p class="text-xs text-muted-foreground">JPG, PNG or WebP. Max 5MB.</p>
					</div>
					<input
						id="avatar-upload"
						type="file"
						accept="image/jpeg,image/png,image/webp"
						onchange={(e) => ps.onAvatarChange(e)}
						class="sr-only"
					/>
				</div>

				<FormInput
					id="email"
					name="email"
					label="Email"
					type="email"
					value={data.user?.email}
					disabled
					icon={User}
					class="bg-muted"
					helpText="Email address cannot be changed."
				/>

				<FormInput
					id="phoneNumber"
					name="phoneNumber"
					label="Phone Number"
					type="tel"
					bind:value={ps.phoneNumber}
					placeholder="0123456789"
					icon={Phone}
					validationState={ps.phoneValidation.state}
					error={ps.phoneValidation.state === 'error' ? ps.phoneValidation.message : undefined}
					success={ps.phoneValidation.state === 'success' ? ps.phoneValidation.message : undefined}
					warning={ps.phoneValidation.state === 'warning' ? ps.phoneValidation.message : undefined}
					helpText="Used for debt discovery by others."
				/>
			</Card.Content>
			<Card.Footer>
				<Button
					type="submit"
					disabled={ps.isSubmitting ||
						ps.phoneValidation.state === 'error' ||
						ps.phoneNumber === data.user?.phoneNumber}
				>
					{#if ps.isSubmitting}
						Saving...
					{:else}
						Save Changes
					{/if}
				</Button>
			</Card.Footer>
		</Card.Root>
	</form>
</div>
