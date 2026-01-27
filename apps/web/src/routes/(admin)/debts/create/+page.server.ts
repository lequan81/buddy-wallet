import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createTreatyClient } from '$lib/eden';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(303, '/login');
	return {};
};

export const actions: Actions = {
	default: async ({ request, fetch }) => {
		const formData = await request.formData();
		const amount = Number(formData.get('amount'));
		const description = formData.get('description') as string;
		const counterpartyPhone = formData.get('counterpartyPhone') as string;
		const direction = formData.get('direction') as 'LEND' | 'BORROW';

		if (!amount || !description || !counterpartyPhone || !direction) {
			return fail(400, { message: 'All fields are required' });
		}

		try {
			const api = createTreatyClient(fetch);
			const { error } = await api.v1.debts.post({
				amount,
				description,
				counterpartyPhone,
				direction
			});

			if (error) {
				return fail(400, { message: error.value || 'Failed to create debt' });
			}
		} catch (err) {
			console.error(err);
			return fail(500, { message: 'Server connection failed' });
		}

		throw redirect(303, '/dashboard');
	}
};
