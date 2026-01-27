import type { PageServerLoad } from './$types';
import { API_URL, getAuthHeaders } from '$lib/api';

export const load: PageServerLoad = async ({ fetch, locals, parent }) => {
	// Get server-computed permissions from layout
	const { permissions } = await parent();
	const headers = getAuthHeaders(locals.accessToken);

	try {
		// Only fetch users if server says user can manage them
		const usersPromise = permissions.canManageUsers
			? fetch(`${API_URL}/v1/users`, { headers })
			: Promise.resolve(new Response(JSON.stringify({ success: true, users: [] })));

		// Everyone gets their debts (controller handles scoping)
		const debtsPromise = fetch(`${API_URL}/v1/debts`, { headers });

		// Run in parallel
		const [usersRes, debtsRes] = await Promise.all([usersPromise, debtsPromise]);

		// Helper to safely parse JSON
		const safeJson = async (res: Response, defaultVal: unknown) => {
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
			users: (usersData as { users: unknown[] }).users || [],
			debts: Array.isArray(debtsData) ? debtsData : []
		};
	} catch (err) {
		console.error('[Dashboard] Failed to fetch data:', err);
		return { users: [], debts: [], error: 'Unable to connect to server' };
	}
};
