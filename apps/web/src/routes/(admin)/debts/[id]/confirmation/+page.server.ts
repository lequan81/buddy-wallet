import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params, url }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const status = url.searchParams.get('status') || 'confirmed';

	const { api } = locals;

	// Fetch all debts and find the one with matching ID
	const { data, error } = await api.v1.debts.get();

	if (error) {
		return { debt: null, error: 'Unable to fetch debt', status };
	}

	const debts = Array.isArray((data as { data?: unknown[] } | null)?.data)
		? ((data as { data?: unknown[] }).data as Array<{
				id: string;
				creditorId?: string | null;
				creditorPhone?: string | null;
				debtorId?: string | null;
				debtorPhone?: string | null;
		  }>)
		: [];

	const debt = debts.find((d: { id: string }) => d.id === params.id);

	if (!debt) {
		return { debt: null, error: 'Debt not found', status };
	}

	// Check if user is related to this debt
	const isCreditor =
		debt.creditorId === locals.user.id || debt.creditorPhone === locals.user.phoneNumber;
	const isDebtor = debt.debtorId === locals.user.id || debt.debtorPhone === locals.user.phoneNumber;

	return {
		debt,
		isCreditor,
		isDebtor,
		status,
		currentUser: locals.user
	};
};
