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
			: Promise.resolve(new Response(JSON.stringify({ success: true, data: { users: [] } })));

		// Everyone gets their debts (controller handles scoping)
		const debtsPromise = fetch(`${API_URL}/v1/debts`, { headers });

		// Run in parallel
		const [usersRes, debtsRes] = await Promise.all([usersPromise, debtsPromise]);

		// Helper to safely parse JSON and extract data from { success, data } response
		const safeJson = async <T>(res: Response, defaultVal: T): Promise<T> => {
			if (!res.ok) return defaultVal;
			try {
				const json = await res.json();
				// API returns { success: true, data: { ... } }
				return json.data ?? json ?? defaultVal;
			} catch {
				return defaultVal;
			}
		};

		const usersData = await safeJson<{ users: unknown[] }>(usersRes, { users: [] });
		const debtsData = await safeJson<{ debts: unknown[] }>(debtsRes, { debts: [] });

		return {
			users: usersData.users || [],
			debts: debtsData.debts || []
		};
	} catch (err) {
		console.error('[Dashboard] Failed to fetch data:', err);
		return { users: [], debts: [], error: 'Unable to connect to server' };
	}
};
