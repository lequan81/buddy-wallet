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

	const user = await userRes.json();

	// Fetch user's debts
	const debtsRes = await fetch(`${API_URL}/v1/debts/user/${params.id}`, { headers });

	const debts = debtsRes.ok ? await debtsRes.json() : [];

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
			return fail(response.status, { error: data.message || 'Failed to update status' });
		}

		return { success: true };
	}
};
