<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { Button } from '@repo/ui/components/ui/button';
	import { Input } from '@repo/ui/components/ui/input';
	import { Label } from '@repo/ui/components/ui/label';
	import * as Card from '@repo/ui/components/ui/card';
	import { Separator } from '@repo/ui/components/ui/separator';
	import { User, Phone } from '@lucide/svelte';

	let { data, form } = $props();
	let user = $derived(data.user);

	let isSubmitting = $state(false);
</script>

<div class="space-y-6">
	<div>
		<h3 class="text-lg font-medium">Profile</h3>
		<p class="text-sm text-muted-foreground">This is how others will see you on the site.</p>
	</div>
	<Separator />

	{#if $page.url.searchParams.get('error') === 'missing_phone'}
		<div
			class="rounded-md border border-yellow-500/50 bg-yellow-500/10 p-4 text-sm text-yellow-700 dark:text-yellow-400"
		>
			<p class="font-bold">Phone Number Required</p>
			<p>You must add a phone number to your profile before you can create debts.</p>
		</div>
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
				<div class="grid gap-2">
					<Label for="email">Email</Label>
					<div class="relative">
						<User class="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
						<Input id="email" value={user?.email} disabled class="bg-muted pl-9" />
					</div>
					<p class="text-[0.8rem] text-muted-foreground">Email address cannot be changed.</p>
				</div>

				<div class="grid gap-2">
					<Label for="phoneNumber">Phone Number</Label>
					<div class="relative">
						<Phone class="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
						<Input
							id="phoneNumber"
							name="phoneNumber"
							type="tel"
							value={user?.phoneNumber ?? ''}
							placeholder="+1234567890"
							class="pl-9"
						/>
					</div>
					<p class="text-[0.8rem] text-muted-foreground">Used for debt discovery by others.</p>
				</div>
			</Card.Content>
			<Card.Footer>
				<Button type="submit" disabled={isSubmitting}>
					{#if isSubmitting}
						Saving...
					{:else}
						Save Changes
					{/if}
				</Button>
			</Card.Footer>
		</Card.Root>
	</form>

	{#if form?.success}
		<p class="text-sm text-green-600">Profile updated successfully!</p>
	{:else if form?.message}
		<p class="text-sm text-red-600">{form.message}</p>
	{/if}
</div>
