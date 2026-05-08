import { form, getRequestEvent } from '$app/server';
import { error, invalid } from '@sveltejs/kit';
import { extractApiErrorMessage } from '$lib/services/api-envelope';

export const updateNotifications = form('unchecked' as const, async (data) => {
	const event = getRequestEvent();
	const { user, api } = event.locals;

	if (!user) error(401, { code: 'UNAUTHORIZED', message: 'Unauthorized' });

	const emailNotificationsEnabled = data.emailNotificationsEnabled === 'true';
	const pushNotificationsEnabled = data.pushNotificationsEnabled === 'true';

	// TODO: Replace with dedicated notification preferences endpoint when available
	const notificationPayload = {
		emailNotificationsEnabled,
		pushNotificationsEnabled
	} as Record<string, unknown>;

	const { error: apiError } = await api.v1.user.profile.patch(notificationPayload);

	if (apiError) {
		invalid(extractApiErrorMessage(apiError.value, 'Failed to update notification preferences'));
	}

	return { success: true };
});
