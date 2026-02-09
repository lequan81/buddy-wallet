import type { PageServerLoad } from './$types';
import { API_URL, getAuthHeaders } from '$lib/api';

interface ActivityLog {
	id: string;
	action: string;
	resource: string;
	resourceId: string | null;
	changes: { before?: Record<string, unknown>; after?: Record<string, unknown> } | null;
	metadata: Record<string, unknown> | null;
	ipAddress: string | null;
	userAgent: string | null;
	createdAt: string;
}

interface Pagination {
	total: number;
	limit: number;
	offset: number;
	hasMore: boolean;
}

export const load: PageServerLoad = async ({ fetch, locals, url }) => {
	const page = parseInt(url.searchParams.get('page') || '1');
	const pageSize = parseInt(url.searchParams.get('pageSize') || '20');
	const offset = (page - 1) * pageSize;

	const headers = getAuthHeaders(locals.accessToken);

	try {
		const response = await fetch(`${API_URL}/v1/activity?limit=${pageSize}&offset=${offset}`, {
			headers
		});

		if (!response.ok) {
			return {
				logs: [] as ActivityLog[],
				pagination: { total: 0, limit: pageSize, offset: 0, hasMore: false } as Pagination,
				page,
				pageSize,
				error: 'Failed to fetch activity logs'
			};
		}

		const data = await response.json();
		return {
			logs: (data.data?.logs || []) as ActivityLog[],
			pagination: (data.data?.pagination || { total: 0, limit: pageSize, offset: 0, hasMore: false }) as Pagination,
			page,
			pageSize
		};
	} catch (err) {
		console.error('[Activity] Failed to fetch logs:', err);
		return {
			logs: [] as ActivityLog[],
			pagination: { total: 0, limit: pageSize, offset: 0, hasMore: false } as Pagination,
			page,
			pageSize,
			error: 'Unable to connect to server'
		};
	}
};
