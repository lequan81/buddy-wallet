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

	// Only fetch users if server says user can manage them
	// We do NOT await here - we return the promise to stream it
	const usersPromise = permissions.canManageUsers
		? fetch(`${API_URL}/v1/users`, { headers }).then(r => r.json()).then(r => r.data?.users || r.users || [])
		: Promise.resolve([]);

	// Build debts URL with pagination params
	const debtsParams = new URLSearchParams({
		limit: pageSize.toString(),
		offset: offset.toString()
	});
	if (statusFilter !== 'all') {
		debtsParams.set('status', statusFilter);
	}
	
	// We do NOT await here either
	const debtsPromise = fetch(`${API_URL}/v1/debts?${debtsParams.toString()}`, { headers })
		.then(r => r.json())
		.then(r => {
			const data = r.data || r;
			return {
				debts: data.debts || [],
				pagination: data.pagination || { total: 0, limit: pageSize, offset: 0, hasMore: false }
			};
		})
		.catch(() => ({ 
			debts: [], 
			pagination: { total: 0, limit: pageSize, offset: 0, hasMore: false } 
		}));

	return {
		streamed: {
			users: usersPromise,
			debtsData: debtsPromise
		},
		statusFilter,
		page,
		pageSize,
		currentUser: locals.user
	};
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
