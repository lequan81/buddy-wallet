import { redirect, getParam } from '$lib/services/navigation';
import type { PageServerLoad } from './$types';
import type { Debt } from '@repo/types/core/debt';
import { unwrapData, getErrorMessage } from '$lib/services/api-helpers';


export const load: PageServerLoad = async ({ locals, params, url }) => {
	const status = getParam(url, 'status', 'confirmed');

	if (!locals.user) {
		if (locals.apiOffline) {
			return {
				debt: null,
				error: 'Backend API is unavailable',
				status,
				isCreditor: false,
				isDebtor: false,
				currentUser: null
			};
		}

		redirect(302, '/login');
	}

	// Fetch all debts and find the one with matching ID
	const { data, error } = await locals.api.v1.debts.get({ query: { page: 1, limit: 100 } });

	if (error) {
		return { debt: null, error: 'Unable to fetch debt', status };
	}

	const debts = unwrapData<Debt[]>(data) ?? [];
	const debt = debts.find((d) => d.id === params.id);

	if (!debt) {
		return { debt: null, error: 'Debt not found', status };
	}

	// Check if user is related to this debt
	const isCreditor =
		debt.creditorId === locals.user.id || debt.creditorPhone === locals.user.phoneNumber;
	const isDebtor =
		debt.debtorId === locals.user.id || debt.debtorPhone === locals.user.phoneNumber;

	return {
		debt,
		isCreditor,
		isDebtor,
		status,
		currentUser: locals.user
	};
};
