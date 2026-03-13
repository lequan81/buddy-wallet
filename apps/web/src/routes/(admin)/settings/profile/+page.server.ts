import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { profileSchema, v } from '@repo/validation/client';

export const load: PageServerLoad = async ({ parent }) => {
	// Auth is handled by layout - just get user from parent
	const { user } = await parent();
	return { user };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const formData = await request.formData();
		const phoneNumber = formData.get('phoneNumber') as string;

		// Double-check auth for mutations (defense in depth)
		if (!locals.user) return fail(401, { message: 'Unauthorized' });

		const result = v.safeParse(profileSchema, { phoneNumber });
		if (!result.success) {
			return fail(400, { message: result.issues[0].message });
		}

		const { api } = locals;

		try {
			const { error, status } = await api.v1.users.me.patch({ phoneNumber });

			if (!error) {
				return { success: true };
			} else {
				return fail(status, { message: error?.value?.message || 'Failed to update profile' });
			}
		} catch (_e) {
			return fail(500, { message: 'Server error' });
		}
	}
};
