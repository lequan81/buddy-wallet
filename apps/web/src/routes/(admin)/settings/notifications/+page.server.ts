import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import type { UserWithNotifications } from '@repo/types';

export const load: PageServerLoad = async ({ parent }) => {
	const { user } = (await parent()) as { user: UserWithNotifications | null };
	return {
		preferences: {
			emailNotificationsEnabled: user?.emailNotificationsEnabled ?? false,
			pushNotificationsEnabled: user?.pushNotificationsEnabled ?? false,
			emailVerified: user?.emailVerified ?? false
		}
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'Unauthorized' });

		const formData = await request.formData();
		const emailNotificationsEnabled = formData.get('emailNotificationsEnabled') === 'true';
		const pushNotificationsEnabled = formData.get('pushNotificationsEnabled') === 'true';

		const { api } = locals;

		const { error, status } = await api.v1.users.me.patch({
			emailNotificationsEnabled,
			pushNotificationsEnabled
		});

		if (!error) {
			return { success: true };
		} else {
			return fail(status, {
				message: error?.value?.message || 'Failed to update notification preferences'
			});
		}
	}
};
