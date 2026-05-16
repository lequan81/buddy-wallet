import { getIntParam } from '$lib/services/navigation';
import type { PageServerLoad } from './$types';
import type { ActivityLog } from '@repo/types/core/activity';
import type { Pagination } from '@repo/types/api/pagination';
import { unwrapData, unwrapPagination } from '$lib/services/api-helpers';

type ActivityRoute = {
	get: (args: {
		query: { limit: string; page: string };
	}) => Promise<{ data: unknown; error: { value: unknown } | null }>;
};

type ActivityApi = {
	activity?: ActivityRoute;
};

export const load: PageServerLoad = async ({ locals, url }) => {
	const page = getIntParam(url, 'page', 1);
	const pageSize = getIntParam(url, 'pageSize', 20);

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
			? ((error.value as { message?: string })?.message || 'Failed to fetch activity logs')
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

	const logs = unwrapData<ActivityLog[]>(data) ?? [];
	const paginationData = unwrapPagination(data, { page, limit: pageSize });

	return {
		logs,
		pagination: {
			total: paginationData.total,
			limit: paginationData.limit,
			page: paginationData.page,
			offset: (paginationData.page - 1) * paginationData.limit,
			hasMore: paginationData.page < paginationData.totalPages
		} satisfies Pagination,
		page,
		pageSize
	};
};
