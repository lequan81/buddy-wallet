<script lang="ts">
	import Key from '~icons/lucide/key';
	import { Button } from '$lib/components/ui/button';
	import FormInput from '$lib/components/forms/FormInput.svelte';
	import { changePassword } from '$lib/remotes/security.remote';
	import { toast } from 'svelte-sonner';

	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let isSubmitting = $state(false);

	// Password strength rules derived from state
	const passwordRules = $derived([
		{ label: 'At least 8 characters', valid: newPassword.length >= 8 },
		{ label: 'One uppercase letter', valid: /[A-Z]/.test(newPassword) },
		{ label: 'One lowercase letter', valid: /[a-z]/.test(newPassword) },
		{ label: 'One number', valid: /\d/.test(newPassword) },
		{ label: 'One special character', valid: /[!@#$%^&*(),.?":{}|<>]/.test(newPassword) }
	]);

	const newPasswordValidation = $derived.by(() => {
		if (!newPassword) return 'default';
		const requirementsMet = passwordRules.filter(r => r.valid).length;
		if (requirementsMet < 3) return 'error';
		if (requirementsMet < 5) return 'warning';
		return 'success';
	});

	const confirmPasswordValidation = $derived.by(() => {
		if (!confirmPassword) return 'default';
		if (confirmPassword !== newPassword) return 'error';
		return 'success';
	});

	// Show errors from remote function
	$effect(() => {
		const issues = changePassword.fields.allIssues();
		if (issues && issues.length > 0) {
			toast.error(issues[0].message);
		}
	});
</script>

<div class="rounded-lg bg-white p-6 shadow-[0_4px_12px_rgba(0,0,0,0.03)] dark:bg-zinc-900 dark:shadow-[0_4px_12px_rgba(0,0,0,0.2)]">
	<div class="mb-6 flex items-center gap-2 border-b border-zinc-100 pb-4 dark:border-zinc-800">
		<Key class="h-4 w-4 text-muted-foreground" />
		<h4 class="text-sm font-medium">Change Password</h4>
	</div>

	<form
		{...changePassword.enhance(async ({ submit }) => {
			isSubmitting = true;
			try {
				await submit();
				toast.success('Password changed successfully');
				currentPassword = '';
				newPassword = '';
				confirmPassword = '';
			} finally {
				isSubmitting = false;
			}
		})}
		class="space-y-4"
	>
		<FormInput
			label="Current Password"
			name="currentPassword"
			type="password"
			bind:value={currentPassword}
			required
		/>

		<div class="space-y-2">
			<FormInput
				label="New Password"
				name="newPassword"
				type="password"
				bind:value={newPassword}
				validationState={newPasswordValidation}
				success={newPasswordValidation === 'success' ? 'Password strength: Strong' : undefined}
				warning={newPasswordValidation === 'warning' ? 'Password strength: Medium' : undefined}
				required
			/>
			
			<div class="grid grid-cols-2 gap-x-4 gap-y-1 pt-1">
				{#each passwordRules as rule (rule.label)}
					<div class="flex items-center gap-1.5 text-[10px]">
						<div class="h-1.5 w-1.5 rounded-full {rule.valid ? 'bg-success' : 'bg-muted'}"></div>
						<span class={rule.valid ? 'text-success' : 'text-muted-foreground'}>{rule.label}</span>
					</div>
				{/each}
			</div>
		</div>

		<FormInput
			label="Confirm New Password"
			name="confirmPassword"
			type="password"
			bind:value={confirmPassword}
			validationState={confirmPasswordValidation}
			error={confirmPasswordValidation === 'error' ? 'Passwords do not match' : undefined}
			success={confirmPasswordValidation === 'success' ? 'Passwords match' : undefined}
			required
		/>

		<div class="flex justify-end pt-2">
			<Button type="submit" disabled={isSubmitting}>
				{isSubmitting ? 'Updating...' : 'Update Password'}
			</Button>
		</div>
	</form>
</div>
