import { form, getRequestEvent } from '$app/server';
import { error, invalid } from '@sveltejs/kit';

export const updateNotifications = form('unchecked' as const, async (data) => {
	const event = getRequestEvent();
	const { user, api } = event.locals;

	if (!user) error(401, { code: 'UNAUTHORIZED', message: 'Unauthorized' });

	const emailNotificationsEnabled = data.emailNotificationsEnabled === 'true';
	const pushNotificationsEnabled = data.pushNotificationsEnabled === 'true';

	try {
		const { error: apiError } = await api.v1.user.profile.patch({
			emailNotificationsEnabled,
			pushNotificationsEnabled
		});

		if (apiError) {
			invalid(apiError.value?.message || 'Failed to update notification preferences');
		}

		return { success: true };
	} catch (err) {
		if (err && typeof err === 'object' && ('status' in err || 'location' in err || 'issues' in err)) {
			throw err;
		}
		console.error('[notifications.remote:updateNotifications] Unexpected Error:', err);
		invalid(`Unable to update notifications: ${err instanceof Error ? err.message : 'Unknown error'}`);
	}
});
