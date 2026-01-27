import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { API_URL, getAuthHeaders } from '$lib/api';

export const load: PageServerLoad = async ({ locals, fetch, parent }) => {
	// Get server-computed permissions from layout
	const { permissions } = await parent();

	// Only users with canManageUsers permission can access this page
	if (!permissions.canManageUsers) {
		throw redirect(302, '/dashboard');
	}

	const headers = getAuthHeaders(locals.accessToken);
	const response = await fetch(`${API_URL}/v1/users`, { headers });

	if (!response.ok) {
		return { users: [], error: 'Failed to fetch users' };
	}

	const data = await response.json();

	return { users: data.users || [] };
};
