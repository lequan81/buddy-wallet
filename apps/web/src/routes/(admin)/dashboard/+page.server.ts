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

interface Pagination {
	total: number;
	limit: number;
	offset: number;
	hasMore: boolean;
}

export const load: PageServerLoad = async ({ fetch, locals, parent, url }) => {
	const statusFilter = url.searchParams.get('status') || 'all';
	const page = parseInt(url.searchParams.get('page') || '1');
	const pageSize = parseInt(url.searchParams.get('pageSize') || '10');
	const offset = (page - 1) * pageSize;
	
	// Get server-computed permissions from layout
	const { permissions } = await parent();
	const headers = getAuthHeaders(locals.accessToken);

	try {
		// Only fetch users if server says user can manage them
		const usersPromise = permissions.canManageUsers
			? fetch(`${API_URL}/v1/users`, { headers })
			: Promise.resolve(new Response(JSON.stringify({ success: true, data: { users: [] } })));

		// Build debts URL with pagination params
		const debtsParams = new URLSearchParams({
			limit: pageSize.toString(),
			offset: offset.toString()
		});
		if (statusFilter !== 'all') {
			debtsParams.set('status', statusFilter);
		}
		
		const debtsPromise = fetch(`${API_URL}/v1/debts?${debtsParams.toString()}`, { headers });

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
		const debtsData = await safeJson<{ debts: Debt[]; pagination: Pagination }>(debtsRes, { 
			debts: [], 
			pagination: { total: 0, limit: pageSize, offset: 0, hasMore: false } 
		});

		return {
			users: usersData.users || [],
			debts: debtsData.debts || [],
			pagination: debtsData.pagination,
			statusFilter,
			page,
			pageSize,
			currentUser: locals.user
		};
	} catch (err) {
		console.error('[Dashboard] Failed to fetch data:', err);
		return { 
			users: [] as User[], 
			debts: [] as Debt[], 
			pagination: { total: 0, limit: pageSize, offset: 0, hasMore: false },
			error: 'Unable to connect to server', 
			statusFilter, 
			page,
			pageSize,
			currentUser: locals.user 
		};
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
