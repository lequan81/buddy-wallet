import { toast } from 'svelte-sonner';
import { updateProfile } from '$lib/remotes/profile.remote';

type ValidationState = 'default' | 'success' | 'error' | 'warning';

export class ProfileState {
	phoneNumber = $state('');
	loading = $state(false);
	avatarPreview = $state<string | null>(null);
	showSuccess = $state(false);
	isSubmitting = $state(false);
	
	// Private user reference
	#getUser: () => any;

	constructor(getUser: () => any) {
		this.#getUser = getUser;
		const user = getUser();
		if (user?.phoneNumber) {
			this.phoneNumber = user.phoneNumber;
		}
	}

	phoneValidation = $derived.by(() => {
		if (this.phoneNumber === this.#getUser()?.phoneNumber || this.phoneNumber === '') {
			return { state: 'default' as ValidationState, message: '' };
		}

		if (this.phoneNumber.length < 10) {
			return { state: 'error' as ValidationState, message: 'Phone number must be at least 10 digits' };
		}

		const phoneRegex = /^0\d{9}$/;
		if (!phoneRegex.test(this.phoneNumber)) {
			return { state: 'warning' as ValidationState, message: 'Phone should start with 0 and be 10 digits' };
		}

		return { state: 'success' as ValidationState, message: 'Phone number looks good' };
	});

	async onAvatarChange(e: Event) {
		const target = e.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		this.loading = true;
		try {
			const reader = new FileReader();
			const result = await new Promise<string>((resolve, reject) => {
				reader.onload = () => resolve(reader.result as string);
				reader.onerror = () => reject(new Error('Failed to read image file'));
				reader.readAsDataURL(file);
			});
			this.avatarPreview = result;
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to read image file');
		} finally {
			this.loading = false;
		}
	}

	handleUpdateResult() {
		if (updateProfile.result?.success) {
			this.showSuccess = true;
			toast.success('Profile updated successfully!');
			setTimeout(() => (this.showSuccess = false), 5000);
		}
		
		const issues = updateProfile.fields.allIssues();
		if (issues && issues.length > 0) {
			toast.error(issues[0].message);
		}
	}
}
