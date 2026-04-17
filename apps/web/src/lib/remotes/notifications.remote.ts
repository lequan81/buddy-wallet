import { form, getRequestEvent } from '$app/server';
import { error, invalid } from '@sveltejs/kit';
import * as v from 'valibot';

export const updateNotifications = form(
	v.object({
		emailNotificationsEnabled: v.union([v.literal('true'), v.literal('false')]),
		pushNotificationsEnabled: v.union([v.literal('true'), v.literal('false')])
	}),
	async (data) => {
		const event = getRequestEvent();
		const { user, api: locals } = event.locals;

		if (!user) error(401, { code: 'UNAUTHORIZED', message: 'Unauthorized' });

		const emailNotificationsEnabled = data.emailNotificationsEnabled === 'true';
		const pushNotificationsEnabled = data.pushNotificationsEnabled === 'true';

		const { error: apiError, status } = await (locals as any).api.v1.users.index.patch({
			id: user?.id || '',
			emailNotificationsEnabled,
			pushNotificationsEnabled
		});

		if (apiError) {
			invalid((apiError.value as any)?.message || 'Failed to update notification preferences');
		}

		return { success: true };
	}
);
