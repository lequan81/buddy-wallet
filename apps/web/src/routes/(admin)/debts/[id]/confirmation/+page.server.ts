import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { API_URL, getAuthHeaders } from '$lib/api';

export const load: PageServerLoad = async ({ locals, fetch, params, url }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const status = url.searchParams.get('status') || 'confirmed';

	const headers = getAuthHeaders(locals.accessToken);

	// Fetch all debts and find the one with matching ID
	const debtsRes = await fetch(`${API_URL}/v1/debts`, { headers });

	if (!debtsRes.ok) {
		return { debt: null, error: 'Unable to fetch debt', status };
	}

	const debtsWrapper = await debtsRes.json();
	const debts = debtsWrapper.data?.debts || [];

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
