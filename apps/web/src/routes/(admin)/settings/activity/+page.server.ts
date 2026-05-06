import type { PageServerLoad } from './$types';
import type { ActivityLog } from '@repo/types/core/activity';
import type { Pagination } from '@repo/types/api/pagination';
import { extractApiData, extractApiErrorMessage, buildPaginationFromMeta } from '$lib/services/api-envelope';

type ActivityRoute = {
	get: (args: {
		query: { limit: string; page: string };
	}) => Promise<{ data: unknown; error: { value: unknown } | null }>;
};

type ActivityApi = {
	activity?: ActivityRoute;
};

export const load: PageServerLoad = async ({ locals, url }) => {
	const page = parseInt(url.searchParams.get('page') || '1');
	const pageSize = parseInt(url.searchParams.get('pageSize') || '20');

	const { api } = locals;
	const activityApi = api.v1 as unknown as ActivityApi;
	const fallbackPagination: Pagination = { total: 0, limit: pageSize, page, offset: (page - 1) * pageSize, hasMore: false };

	const route = activityApi.activity;
	if (!route?.get) {
		return {
			logs: [] as ActivityLog[],
			pagination: fallbackPagination,
			page,
			pageSize,
			error: 'Activity endpoint not available'
		};
	}

	const { data, error } = await route.get({
		query: { limit: pageSize.toString(), page: page.toString() }
	});

	if (error || !data) {
		const message = error
			? extractApiErrorMessage(error.value, 'Failed to fetch activity logs')
			: 'Failed to fetch activity logs';
		console.error('[Activity] Failed to fetch logs:', Object.assign({}, error || {}));
		return {
			logs: [] as ActivityLog[],
			pagination: fallbackPagination,
			page,
			pageSize,
			error: message
		};
	}

	const parsed = extractApiData<ActivityLog[]>(data);
	const logs = Array.isArray(parsed.data) ? parsed.data : [];
	const pagination = buildPaginationFromMeta(parsed.meta, page, pageSize);

	return {
		logs,
		pagination,
		page,
		pageSize
	};
};
