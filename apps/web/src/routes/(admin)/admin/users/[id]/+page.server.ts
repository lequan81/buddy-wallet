import { redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) {
		if (locals.apiOffline) {
			return { targetUser: null, debts: [], error: 'Backend API is unavailable' };
		}

		throw redirect(302, '/login');
	}

	if (locals.user.role !== 'admin') {
		throw redirect(302, '/dashboard');
	}

	// Fetch user details
	const { data: userData, error: userError } = await locals.api.v1.users({ id: params.id }).get();

	if (userError) {
		return { targetUser: null, debts: [], error: 'User not found' };
	}

	// API returns { success: true, data: { item: {...} } }
		const user = (userData && !('error' in userData) ? userData.item : null) || null;
	// Fetch user's debts
		const { data: debtsData } = await (locals.api.v1.debts as any).index.get({ query: { userId: params.id } });
	// API returns paginated debts
	const debts = debtsData?.items || [];

	return { targetUser: user, debts };
};

export const actions: Actions = {
	toggleStatus: async ({ locals, params }) => {
		if (!locals.user || locals.user.role !== 'admin') {
			return fail(403, { error: 'Access denied' });
		}

		const { error, status } = await locals.api.v1.users({ id: params.id }).status.patch();

		if (error) {
			const errorData = error.value as { error?: { message?: string; details?: string } };
			const errorMsg =
				errorData?.error?.message ||
				errorData?.error?.details ||
				'Failed to update status';
			return fail(typeof status === 'number' ? status : 500, { error: errorMsg });
		}

		return { success: true };
	}
};
