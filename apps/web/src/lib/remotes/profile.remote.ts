import { form, getRequestEvent } from '$app/server';
import { error, invalid } from '@sveltejs/kit';
import { profileSchema } from '@repo/validation/client';

export const updateProfile = form(profileSchema, async (data) => {
	const event = getRequestEvent();
	const { user, api } = event.locals;

	if (!user) error(401, { code: 'UNAUTHORIZED', message: 'Unauthorized' });

	const { error: apiError } = await api.v1.users.me.patch({
		phoneNumber: data.phoneNumber
	});

	if (apiError) {
		invalid((apiError.value as { message?: string })?.message || 'Failed to update profile');
	}

	return { success: true };
});
