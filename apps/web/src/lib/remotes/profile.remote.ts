import { form, getRequestEvent } from '$app/server';
import { error, invalid } from '@sveltejs/kit';
import { updateProfileSchema } from '@repo/schema/dto/profile';
import { toStandardSchema } from '@repo/schema/adapters/standard-schema';

export const updateProfile = form(toStandardSchema(updateProfileSchema), async (data) => {
	const event = getRequestEvent();
	const { user, api } = event.locals;

	if (!user) error(401, { code: 'UNAUTHORIZED', message: 'Unauthorized' });

	try {
		const { error: apiError } = await api.v1.user.profile.patch({
			name: data.name,
			email: data.email
		});

		if (apiError) {
			invalid(apiError.value?.message || 'Failed to update profile');
		}

		return { success: true };
	} catch (err) {
		if (err && typeof err === 'object' && ('status' in err || 'location' in err || 'issues' in err)) {
			throw err;
		}
		console.error('[profile.remote:updateProfile] Unexpected Error:', err);
		invalid(`Unable to update profile: ${err instanceof Error ? err.message : 'Unknown error'}`);
	}
});
