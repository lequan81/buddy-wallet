import { redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { API_URL, getAuthHeaders } from '$lib/api';

export const load: PageServerLoad = async ({ locals, fetch, params }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const headers = getAuthHeaders(locals.accessToken);

	// Fetch all debts and find the one with matching ID
	const debtsRes = await fetch(`${API_URL}/v1/debts`, { headers });

	if (!debtsRes.ok) {
		return { debt: null, error: 'Unable to fetch debt' };
	}

	const debtsWrapper = await debtsRes.json();
	const debts = debtsWrapper.data?.debts || [];

	const debt = debts.find((d: { id: string }) => d.id === params.id);

	if (!debt) {
		return { debt: null, error: 'Debt not found' };
	}

	// Check if user is related to this debt
	const isCreditor = debt.creditorId === locals.user.id || debt.creditorPhone === locals.user.phoneNumber;
	const isDebtor = debt.debtorId === locals.user.id || debt.debtorPhone === locals.user.phoneNumber;
	const isUploader = debt.uploadedById === locals.user.id;

	if (!isCreditor && !isDebtor && !isUploader) {
		return { debt: null, error: 'Access denied' };
	}

	return {
		debt,
		isCreditor,
		isDebtor,
		isUploader,
		currentUser: locals.user
	};
};

export const actions: Actions = {
	updateStatus: async ({ locals, fetch, params, request }) => {
		if (!locals.user) {
			return fail(401, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const status = formData.get('status') as string;

		if (!status) {
			return fail(400, { error: 'Status is required' });
		}

		const headers = getAuthHeaders(locals.accessToken);

		const response = await fetch(`${API_URL}/v1/debts/${params.id}/status`, {
			method: 'PATCH',
			headers: {
				...headers,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ status })
		});

		if (!response.ok) {
			const data = await response.json().catch(() => ({}));
			const errorMsg = data.error?.message || data.error?.details || 'Failed to update status';
			return fail(response.status, { error: errorMsg });
		}

		// Redirect to confirmation page for paid/confirmed status changes
		if (status === 'paid' || status === 'confirmed') {
			throw redirect(303, `/debts/${params.id}/confirmation?status=${status}`);
		}

		return { success: true, status };
	},

	update: async ({ locals, fetch, params, request }) => {
		if (!locals.user) {
			return fail(401, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const description = formData.get('description') as string;
		const amount = formData.get('amount');

		const body: Record<string, unknown> = {};
		if (description) body.description = description;
		if (amount) body.amount = Number(amount);

		const headers = getAuthHeaders(locals.accessToken);

		const response = await fetch(`${API_URL}/v1/debts/${params.id}`, {
			method: 'PUT',
			headers: {
				...headers,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(body)
		});

		if (!response.ok) {
			const data = await response.json().catch(() => ({}));
			const errorMsg = data.error?.message || data.error?.details || 'Failed to update debt';
			return fail(response.status, { error: errorMsg });
		}

		return { success: true, message: 'Debt updated successfully' };
	},

	delete: async ({ locals, fetch, params }) => {
		if (!locals.user) {
			return fail(401, { error: 'Unauthorized' });
		}

		const headers = getAuthHeaders(locals.accessToken);

		const response = await fetch(`${API_URL}/v1/debts/${params.id}`, {
			method: 'DELETE',
			headers
		});

		if (!response.ok) {
			const data = await response.json().catch(() => ({}));
			const errorMsg = data.error?.message || data.error?.details || 'Failed to delete debt';
			return fail(response.status, { error: errorMsg });
		}

		throw redirect(303, '/dashboard?deleted=true');
	}
};
