import { redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals, fetch, params, request }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	if (locals.user.role !== 'admin') {
		throw redirect(302, '/dashboard');
	}

	const cookie = request.headers.get('cookie') || '';

	// Fetch user details
	const userRes = await fetch(`http://localhost:3000/v1/users/${params.id}`, {
		headers: { cookie }
	});

	if (!userRes.ok) {
		return { targetUser: null, debts: [], error: 'User not found' };
	}

	const user = await userRes.json();

	// Fetch user's debts
	const debtsRes = await fetch(`http://localhost:3000/v1/debts/user/${params.id}`, {
		headers: { cookie }
	});

	const debts = debtsRes.ok ? await debtsRes.json() : [];

	return { targetUser: user, debts };
};

export const actions: Actions = {
	toggleStatus: async ({ locals, fetch, params, request }) => {
		if (!locals.user || locals.user.role !== 'admin') {
			return fail(403, { error: 'Access denied' });
		}

		const cookie = request.headers.get('cookie') || '';

		const response = await fetch(`http://localhost:3000/v1/users/${params.id}/status`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', cookie }
		});

		if (!response.ok) {
			const data = await response.json().catch(() => ({}));
			return fail(response.status, { error: data.message || 'Failed to update status' });
		}

		return { success: true };
	}
};
