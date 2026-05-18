import { redirect, getIntParam } from '$lib/services/navigation';
import type { PageServerLoad } from './$types';
import type { UserResponse } from '@repo/types/shared/user';
import type { Pagination } from '@repo/types/api/pagination';
import { unwrapData, unwrapPagination } from '$lib/services/api-helpers';

const fallbackPagination = (page: number, pageSize: number): Pagination => ({
	total: 0, limit: pageSize, page, offset: (page - 1) * pageSize, hasMore: false
});

export const load: PageServerLoad = async ({ locals, parent, url }) => {
	const { permissions } = await parent();

	if (!permissions.canManageUsers) {
		if (locals.apiOffline) {
			return {
				users: [] as UserResponse[],
				pagination: { total: 0, limit: 10, page: 1, offset: 0, hasMore: false } as Pagination,
				page: 1,
				pageSize: 10,
				error: 'Backend API is unavailable'
			};
		}

		redirect(302, '/dashboard');
	}

	const page = getIntParam(url, 'page', 1);
	const pageSize = getIntParam(url, 'pageSize', 10);

	try {
		const { data, error } = await locals.api.v1.user.admin.users.get({
			query: {
				limit: pageSize,
				page: page
			}
		});

		if (error) {
			return {
				users: [] as UserResponse[],
				pagination: fallbackPagination(page, pageSize),
				page,
				pageSize,
				error: 'Failed to fetch users'
			};
		}

		const users = unwrapData<UserResponse[]>(data) ?? [];
		const pag = unwrapPagination(data, { page, limit: pageSize });
		return {
			users,
			pagination: {
				total: pag.total,
				limit: pag.limit,
				page: pag.page,
				offset: (pag.page - 1) * pag.limit,
				hasMore: pag.page < pag.totalPages
			} satisfies Pagination,
			page,
			pageSize
		};
	} catch {
		return {
			users: [] as UserResponse[],
			pagination: fallbackPagination(page, pageSize),
			page,
			pageSize,
			error: 'Failed to fetch users'
		};
	}
};

