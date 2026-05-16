import { form, getRequestEvent } from '$app/server';
import { error, invalid } from '@sveltejs/kit';
import { profileSchema } from '@repo/schema/dto/profile';
import { toStandardSchema } from '@repo/schema/adapters/standard-schema';

export const updateProfile = form(toStandardSchema(profileSchema), async (data) => {
	const event = getRequestEvent();
	const { user, api } = event.locals;

	if (!user) error(401, { code: 'UNAUTHORIZED', message: 'Unauthorized' });

	const { error: apiError } = await api.v1.user.profile.patch({
		phoneNumber: data.phoneNumber
	} as Record<string, unknown>);

	if (apiError) {
		invalid((apiError.value?.message || 'Failed to update profile'));
	}

	return { success: true };
});
