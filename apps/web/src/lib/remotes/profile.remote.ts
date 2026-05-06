import { form, getRequestEvent } from '$app/server';
import { error, invalid } from '@sveltejs/kit';
import { profileSchema } from '@repo/schema/dto/profile';
import { toStandardSchema } from '@repo/schema/adapters/standard-schema';
import { extractApiErrorMessage } from '$lib/services/api-envelope';

export const updateProfile = form(toStandardSchema(profileSchema), async (data) => {
	const event = getRequestEvent();
	const { user, api } = event.locals;

	if (!user) error(401, { code: 'UNAUTHORIZED', message: 'Unauthorized' });

	const { error: apiError } = await api.v1.user.profile.patch({
		phoneNumber: data.phoneNumber
	});

	if (apiError) {
		invalid(extractApiErrorMessage(apiError.value, 'Failed to update profile'));
	}

	return { success: true };
});
