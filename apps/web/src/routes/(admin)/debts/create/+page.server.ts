import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createTreatyClient } from '$lib/eden';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(303, '/login');

	// User must have a phone number to create debts
	if (!locals.user.phoneNumber) {
		throw redirect(303, '/settings/profile?error=missing_phone');
	}

	return {};
};

export const actions: Actions = {
	default: async ({ request, fetch, locals }) => {
		const formData = await request.formData();
		const amount = Number(formData.get('amount'));
		const description = formData.get('description') as string;
		const counterpartyPhone = formData.get('counterpartyPhone') as string;
		const direction = formData.get('direction') as 'LEND' | 'BORROW';

		// User must have a phone number to create debts
		// Note: locals.user might be stale if profile updated in same session without re-login logic,
		// but standard flow updates it. Let's rely on locals for now but ensure we check it.
		// Actually, locals.user comes from hooks.server.ts which validates session on every request.

		if (!locals.user?.phoneNumber) {
			throw redirect(303, '/settings/profile?error=missing_phone');
		}

		if (!amount || !description || !counterpartyPhone || !direction) {
			return fail(400, { message: 'All fields are required' });
		}

		try {
			const api = createTreatyClient(fetch);
			const { data, error, status } = await api.v1.debts.post({
				amount,
				description,
				counterpartyPhone,
				direction
			});

			console.log('[Debt Create] Response:', { data, error: error?.value, status });

			if (error) {
				const errorObj = (error.value as any)?.error;
				const errorMsg = errorObj?.details || errorObj?.message || 'Failed to create debt';
				return fail(400, { message: errorMsg });
			}
		} catch (err) {
			console.error(err);
			return fail(500, { message: 'Server connection failed' });
		}

		throw redirect(303, '/dashboard');
	}
};
