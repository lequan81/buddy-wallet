import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { API_URL, getAuthHeaders } from '$lib/api';

interface UserWithNotifications {
	id: string;
	email: string;
	role: string;
	permissions: string[];
	phoneNumber?: string | null;
	emailVerified?: boolean;
	emailNotificationsEnabled?: boolean;
	pushNotificationsEnabled?: boolean;
}

export const load: PageServerLoad = async ({ parent }) => {
	const { user } = await parent() as { user: UserWithNotifications | null };
	return {
		preferences: {
			emailNotificationsEnabled: user?.emailNotificationsEnabled ?? false,
			pushNotificationsEnabled: user?.pushNotificationsEnabled ?? false,
			emailVerified: user?.emailVerified ?? false
		}
	};
};

export const actions: Actions = {
	default: async ({ request, fetch, locals }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });

		const formData = await request.formData();
		const emailNotificationsEnabled = formData.get('emailNotificationsEnabled') === 'true';
		const pushNotificationsEnabled = formData.get('pushNotificationsEnabled') === 'true';

		const headers = getAuthHeaders(locals.accessToken);

		try {
			const res = await fetch(`${API_URL}/v1/users/me`, {
				method: 'PATCH',
				body: JSON.stringify({
					emailNotificationsEnabled,
					pushNotificationsEnabled
				}),
				headers
			});

			const data = await res.json();

			if (res.ok) {
				return { success: true };
			} else {
				return fail(400, { 
					message: data?.error || 'Failed to update notification preferences' 
				});
			}
		} catch (_e) {
			return fail(500, { message: 'Server error' });
		}
	}
};
