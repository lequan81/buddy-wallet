import { form, getRequestEvent } from '$app/server';
import { error, invalid } from '@sveltejs/kit';
import { extractApiErrorMessage } from '$lib/services/api-envelope';

export const updateNotifications = form('unchecked' as const, async (data) => {
	const event = getRequestEvent();
	const { user, api } = event.locals;

	if (!user) error(401, { code: 'UNAUTHORIZED', message: 'Unauthorized' });

	const emailNotificationsEnabled = data.emailNotificationsEnabled === 'true';
	const pushNotificationsEnabled = data.pushNotificationsEnabled === 'true';

	const { error: apiError } = await api.v1.user.profile.patch({
		emailNotificationsEnabled,
		pushNotificationsEnabled
	});

	if (apiError) {
		invalid(extractApiErrorMessage(apiError.value, 'Failed to update notification preferences'));
	}

	return { success: true };
});
