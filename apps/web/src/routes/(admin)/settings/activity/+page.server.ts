import type { PageServerLoad } from './$types';
import type { ActivityLog, Pagination } from '@repo/types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const page = parseInt(url.searchParams.get('page') || '1');
	const pageSize = parseInt(url.searchParams.get('pageSize') || '20');
	const offset = (page - 1) * pageSize;

	const { api } = locals;

	const { data, error } = await api.v1.activity.get({
		query: { limit: pageSize.toString(), offset: offset.toString() }
	});

	if (error) {
		console.error('[Activity] Failed to fetch logs:', Object.assign({}, error));
		return {
			logs: [] as ActivityLog[],
			pagination: { total: 0, limit: pageSize, offset: 0, hasMore: false } as Pagination,
			page,
			pageSize,
			error: 'Failed to fetch activity logs'
		};
	}

	return {
		logs: (data?.success ? data.logs : []) as unknown as ActivityLog[],
		pagination: (data?.success ? data.pagination : {
			total: 0,
			limit: pageSize,
			offset: 0,
			hasMore: false
		}) as Pagination,
		page,
		pageSize
	};
};
