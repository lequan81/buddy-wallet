import { redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { API_URL, getAuthHeaders } from '$lib/api';

export const load: PageServerLoad = async ({ locals, fetch, params }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	if (locals.user.role !== 'admin') {
		throw redirect(302, '/dashboard');
	}

	const headers = getAuthHeaders(locals.accessToken);

	// Fetch user details
	const userRes = await fetch(`${API_URL}/v1/users/${params.id}`, { headers });

	if (!userRes.ok) {
		return { targetUser: null, debts: [], error: 'User not found' };
	}

	const userWrapper = await userRes.json();
	// API returns { success: true, data: { user: {...} } }
	const user = userWrapper.data?.user || null;

	// Fetch user's debts
	const debtsRes = await fetch(`${API_URL}/v1/debts/user/${params.id}`, { headers });

	const debtsWrapper = debtsRes.ok ? await debtsRes.json() : { data: { debts: [] } };
	// API returns { success: true, data: { debts: [...] } }
	const debts = debtsWrapper.data?.debts || [];

	return { targetUser: user, debts };
};

export const actions: Actions = {
	toggleStatus: async ({ locals, fetch, params }) => {
		if (!locals.user || locals.user.role !== 'admin') {
			return fail(403, { error: 'Access denied' });
		}

		const headers = getAuthHeaders(locals.accessToken);

		const response = await fetch(`${API_URL}/v1/users/${params.id}/status`, {
			method: 'PATCH',
			headers
		});

		if (!response.ok) {
			const data = await response.json().catch(() => ({}));
			const errorMsg = data.error?.message || data.error?.details || data.message || 'Failed to update status';
			return fail(response.status, { error: errorMsg });
		}

		return { success: true };
	}
};
