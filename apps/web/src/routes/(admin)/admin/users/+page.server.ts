import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { UserResponse } from '@repo/types/core/user';
import type { Pagination } from '@repo/types/api/pagination';
import { extractApiData, buildPaginationFromMeta } from '$lib/services/api-envelope';

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

		throw redirect(302, '/dashboard');
	}

	const page = Number.parseInt(url.searchParams.get('page') || '1', 10);
	const pageSize = Number.parseInt(url.searchParams.get('pageSize') || '10', 10);

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
				pagination: buildPaginationFromMeta(undefined, page, pageSize),
				page,
				pageSize,
				error: 'Failed to fetch users'
			};
		}

		const parsed = extractApiData<UserResponse[]>(data);
		return {
			users: parsed.data ?? [],
			pagination: buildPaginationFromMeta(parsed.meta, page, pageSize),
			page,
			pageSize
		};
	} catch {
		return {
			users: [] as UserResponse[],
			pagination: buildPaginationFromMeta(undefined, page, pageSize),
			page,
			pageSize,
			error: 'Failed to fetch users'
		};
	}
};
