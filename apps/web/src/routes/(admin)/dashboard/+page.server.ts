import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { API_URL, getAuthHeaders } from '$lib/api';

interface Debt {
	id: string;
	description: string;
	amount: number;
	status: string;
	createdAt: string;
	creditorId?: string;
	debtorId?: string;
	creditorPhone?: string;
	debtorPhone?: string;
	uploadedById?: string;
}

interface User {
	id: string;
	name: string;
	email: string | null;
}

export const load: PageServerLoad = async ({ fetch, locals, parent, url }) => {
	const statusFilter = url.searchParams.get('status') || 'all';
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

		const usersData = await safeJson<{ users: User[] }>(usersRes, { users: [] });
		const debtsData = await safeJson<{ debts: Debt[] }>(debtsRes, { debts: [] });

		return {
			users: usersData.users || [],
			debts: debtsData.debts || [],
			statusFilter,
			currentUser: locals.user
		};
	} catch (err) {
		console.error('[Dashboard] Failed to fetch data:', err);
		return { users: [] as User[], debts: [] as Debt[], error: 'Unable to connect to server', statusFilter, currentUser: locals.user };
	}
};

export const actions: Actions = {
	batchDelete: async ({ locals, fetch, request }) => {
		if (!locals.user) {
			return fail(401, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const idsRaw = formData.get('ids') as string;

		if (!idsRaw) {
			return fail(400, { error: 'No debts selected' });
		}

		const ids = idsRaw.split(',').filter(Boolean);

		if (ids.length === 0) {
			return fail(400, { error: 'No debts selected' });
		}

		if (ids.length > 50) {
			return fail(400, { error: 'Cannot delete more than 50 debts at once' });
		}

		const headers = getAuthHeaders(locals.accessToken);

		const response = await fetch(`${API_URL}/v1/debts/batch`, {
			method: 'DELETE',
			headers: {
				...headers,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ ids })
		});

		if (!response.ok) {
			const data = await response.json().catch(() => ({}));
			const errorMsg = data.error?.message || data.error?.details || 'Failed to delete debts';
			return fail(response.status, { error: errorMsg });
		}

		const result = await response.json();
		return { success: true, deleted: result.data?.deleted || ids.length };
	},

	deleteAll: async ({ locals, fetch }) => {
		if (!locals.user) {
			return fail(401, { error: 'Unauthorized' });
		}

		const headers = getAuthHeaders(locals.accessToken);

		const response = await fetch(`${API_URL}/v1/debts/all?confirm=true`, {
			method: 'DELETE',
			headers
		});

		if (!response.ok) {
			const data = await response.json().catch(() => ({}));
			const errorMsg = data.error?.message || data.error?.details || 'Failed to delete all debts';
			return fail(response.status, { error: errorMsg });
		}

		const result = await response.json();
		return { success: true, deleted: result.data?.deleted || 0 };
	}
};
