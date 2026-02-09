import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { API_URL, getAuthHeaders } from '$lib/api';

interface Pagination {
	total: number;
	limit: number;
	offset: number;
	hasMore: boolean;
}

export const load: PageServerLoad = async ({ locals, fetch, parent, url }) => {
	// Get server-computed permissions from layout
	const { permissions } = await parent();

	// Only users with canManageUsers permission can access this page
	if (!permissions.canManageUsers) {
		throw redirect(302, '/dashboard');
	}

	const page = parseInt(url.searchParams.get('page') || '1');
	const pageSize = parseInt(url.searchParams.get('pageSize') || '10');
	const offset = (page - 1) * pageSize;

	const headers = getAuthHeaders(locals.accessToken);
	const params = new URLSearchParams({
		limit: pageSize.toString(),
		offset: offset.toString()
	});
	
	const response = await fetch(`${API_URL}/v1/users?${params}`, { headers });

	if (!response.ok) {
		return { 
			users: [], 
			pagination: { total: 0, limit: pageSize, offset: 0, hasMore: false } as Pagination,
			page,
			pageSize,
			error: 'Failed to fetch users' 
		};
	}

	const data = await response.json();

	// API returns { success: true, data: { users: [...], pagination: {...} } }
	return { 
		users: data.data?.users || [],
		pagination: data.data?.pagination || { total: 0, limit: pageSize, offset: 0, hasMore: false } as Pagination,
		page,
		pageSize
	};
};
