import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { API_URL, getAuthHeaders } from '$lib/api';

export const load: PageServerLoad = async ({ fetch, locals }) => {
	// 1. Allow any logged-in user
	if (!locals.user) {
		throw redirect(303, '/login');
	}

	const isAdmin = locals.user.role === 'admin';
	const headers = getAuthHeaders(locals.accessToken);

	try {
		// 2. Conditional Fetching
		// Only admin gets full user list.
		const usersPromise = isAdmin
			? fetch(`${API_URL}/v1/users`, { headers })
			: Promise.resolve(new Response(JSON.stringify({ success: true, users: [] })));

		// Everyone gets their debts (controller handles scoping)
		const debtsPromise = fetch(`${API_URL}/v1/debts`, { headers });

		// Run in parallel
		const [usersRes, debtsRes] = await Promise.all([usersPromise, debtsPromise]);

		// Helper to safely parse JSON
		const safeJson = async (res: Response, defaultVal: any) => {
			if (!res.ok) return defaultVal;
			try {
				return await res.json();
			} catch {
				return defaultVal;
			}
		};

		const usersData = await safeJson(usersRes, { users: [] });
		const debtsData = await safeJson(debtsRes, []);

		return {
			users: usersData.users || [],
			debts: Array.isArray(debtsData) ? debtsData : []
		};
	} catch (err) {
		console.error('[Dashboard] Failed to fetch data:', err);
		return { users: [], debts: [], error: 'Unable to connect to server' };
	}
};
