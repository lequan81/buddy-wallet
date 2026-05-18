import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import type { UserWithNotifications } from '@repo/types/shared/user';

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


