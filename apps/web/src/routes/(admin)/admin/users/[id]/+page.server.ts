import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { UserResponse } from '@repo/types/core/user';
import type { Debt } from '@repo/types/core/debt';
import { extractApiData } from '$lib/services/api-envelope';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) {
		if (locals.apiOffline) {
			return { targetUser: null, debts: [] as Debt[], error: 'Backend API is unavailable' };
		}

		throw redirect(302, '/login');
	}

	if (locals.user.role !== 'admin') {
		throw redirect(302, '/dashboard');
	}

	const { data: userData, error: userError } = await locals.api.v1.user.admin.users({ id: params.id }).get();
	if (userError) {
		return { targetUser: null, debts: [] as Debt[], error: 'User not found' };
	}

	const userParsed = extractApiData<UserResponse>(userData);
	const user = userParsed.data;

	let debts: Debt[] = [];
	try {
		const { data: debtsData } = await locals.api.v1.debts.get({
			query: { page: 1, limit: 100 }
		});
		const debtsParsed = extractApiData<Debt[]>(debtsData);
		debts = debtsParsed.data ?? [];
	} catch {
		debts = [];
	}

	return { targetUser: user, debts };
};
