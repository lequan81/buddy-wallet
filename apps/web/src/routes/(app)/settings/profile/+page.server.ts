import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { user } = await parent();
	return { user };
};

export const actions: Actions = {
	default: async ({ request, fetch, locals }) => {
		const formData = await request.formData();
		const phoneNumber = formData.get('phoneNumber') as string;

		if (!locals.user) return fail(401, { message: 'Unauthorized' });

		// Update User via API
		// Assuming we have a PATCH /users/:id or PUT /users/me endpoint?
		// Let's check users.controller.ts, it only has GET /:id and GET / (admin).
		// We need to implement Update functionality in API or hack it here (not recommended).

		// Wait, I need to add UPDATE endpoint to API first.
		// Let's assume I will add it in the next step or right now.
		// I'll assume PUT /users/:id is available or I'll add it.

		// For now, let's fail if not implemented, OR implementation plan implied I should do it.
		// I will add the update endpoint to users.controller.ts in the cleanup.

		try {
			const res = await fetch(`http://localhost:3000/v1/users/${locals.user.id}`, {
				method: 'PATCH',
				body: JSON.stringify({ phoneNumber }),
				headers: {
					'Content-Type': 'application/json',
					Cookie: request.headers.get('cookie') || ''
				}
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
