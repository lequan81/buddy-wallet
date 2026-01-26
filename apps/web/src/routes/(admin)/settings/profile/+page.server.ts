import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { API_URL, getAuthHeaders } from '$lib/api';

export const load: PageServerLoad = async ({ parent }) => {
	const { user } = await parent();
	return { user };
};

export const actions: Actions = {
	default: async ({ request, fetch, locals }) => {
		const formData = await request.formData();
		const phoneNumber = formData.get('phoneNumber') as string;

		if (!locals.user) return fail(401, { message: 'Unauthorized' });

		const headers = getAuthHeaders(locals.accessToken);

		try {
			const res = await fetch(`${API_URL}/v1/users/${locals.user.id}`, {
				method: 'PATCH',
				body: JSON.stringify({ phoneNumber }),
				headers
			});

			if (res.ok) {
				return { success: true };
			} else {
				return fail(400, { message: 'Failed to update profile' });
			}
		} catch (e) {
			return fail(500, { message: 'Server error' });
		}
	}
};
