<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { Button } from '@repo/ui/components/ui/button';
	import { Label } from '@repo/ui/components/ui/label';
	import * as Card from '@repo/ui/components/ui/card';
	import { Separator } from '@repo/ui/components/ui/separator';
	import { User, Phone } from '@lucide/svelte';
	import FormInput from '$lib/components/forms/FormInput.svelte';

	let { data, form } = $props();
	let user = $derived(data.user);

	let isSubmitting = $state(false);

	// Form state
	let phoneNumber = $state('');

	// Initialize phoneNumber from user
	$effect(() => {
		if (user?.phoneNumber) {
			phoneNumber = user.phoneNumber;
		}
	});

	// Validation state
	type ValidationState = 'default' | 'success' | 'error' | 'warning';
	let phoneValidation = $state<ValidationState>('default');
	let phoneMessage = $state('');

	// Real-time phone validation
	$effect(() => {
		if (phoneNumber === user?.phoneNumber || phoneNumber === '') {
			phoneValidation = 'default';
			phoneMessage = '';
			return;
		}

		if (phoneNumber.length < 10) {
			phoneValidation = 'error';
			phoneMessage = 'Phone number must be at least 10 digits';
			return;
		}

		const phoneRegex = /^0\d{9}$/;
		if (!phoneRegex.test(phoneNumber)) {
			phoneValidation = 'warning';
			phoneMessage = 'Phone should start with 0 and be 10 digits';
			return;
		}

		phoneValidation = 'success';
		phoneMessage = 'Phone number looks good';
	});
</script>

<div class="space-y-6">
	<div>
		<h3 class="text-lg font-medium">Profile</h3>
		<p class="text-sm text-muted-foreground">This is how others will see you on the site.</p>
	</div>
	<Separator />

	{#if $page.url.searchParams.get('error') === 'missing_phone'}
		<Card.Root class="border-warning bg-warning/5">
			<Card.Content class="pt-6">
				<p class="font-semibold text-warning">Phone Number Required</p>
				<p class="mt-1 text-sm text-muted-foreground">
					You must add a phone number to your profile before you can create debts.
				</p>
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
				<FormInput
					id="email"
					name="email"
					label="Email"
					type="email"
					value={user?.email}
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
					bind:value={phoneNumber}
					placeholder="0123456789"
					icon={Phone}
					validationState={phoneValidation}
					error={phoneValidation === 'error' ? phoneMessage : undefined}
					success={phoneValidation === 'success' ? phoneMessage : undefined}
					warning={phoneValidation === 'warning' ? phoneMessage : undefined}
					helpText="Used for debt discovery by others."
				/>
			</Card.Content>
			<Card.Footer>
				<Button
					type="submit"
					disabled={isSubmitting || phoneValidation === 'error' || phoneNumber === user?.phoneNumber}
				>
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
