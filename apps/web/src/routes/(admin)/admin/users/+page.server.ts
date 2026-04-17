import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { SafeUser } from '@repo/types/core/user';
import type { Pagination } from '@repo/types/api/pagination';

export const load: PageServerLoad = async ({ locals, parent, url }) => {
	// Get server-computed permissions from layout
	const { permissions } = await parent();

	// Only users with canManageUsers permission can access this page
	if (!permissions.canManageUsers) {
		if (locals.apiOffline) {
			return {
				users: [] as SafeUser[],
				pagination: { total: 0, limit: 10, page: 1, offset: 0, hasMore: false } as Pagination,
				page: 1,
				pageSize: 10,
				error: 'Backend API is unavailable'
			};
		}

		throw redirect(302, '/dashboard');
	}

	const page = parseInt(url.searchParams.get('page') || '1');
	const pageSize = parseInt(url.searchParams.get('pageSize') || '10');
	const offset = (page - 1) * pageSize;

			const { data, error } = await (locals.api.v1.users as any).index.get({
		query: {
			limit: pageSize.toString(),
			offset: offset.toString()
		}
	});

	if (error || !data) {
		return {
			users: [] as SafeUser[],
			pagination: { total: 0, limit: pageSize, page, offset: 0, hasMore: false } as Pagination,
			page,
			pageSize,
			error: 'Failed to fetch users'
		};
	}

	return {
		users: data.items || [],
		pagination: data.pagination,
		page,
		pageSize
	};
};
