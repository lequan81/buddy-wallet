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

export const load: PageServerLoad = async ({ fetch, locals, url }) => {
	const limit = parseInt(url.searchParams.get('limit') || '50');
	const offset = parseInt(url.searchParams.get('offset') || '0');

	const headers = getAuthHeaders(locals.accessToken);

	try {
		const response = await fetch(`${API_URL}/v1/activity?limit=${limit}&offset=${offset}`, {
			headers
		});

		if (!response.ok) {
			return { logs: [] as ActivityLog[], error: 'Failed to fetch activity logs' };
		}

		const data = await response.json();
		return {
			logs: (data.data?.logs || []) as ActivityLog[],
			limit,
			offset
		};
	} catch (err) {
		console.error('[Activity] Failed to fetch logs:', err);
		return { logs: [] as ActivityLog[], error: 'Unable to connect to server' };
	}
};
