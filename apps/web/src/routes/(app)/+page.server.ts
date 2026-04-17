import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import { createTreatyClient } from '$lib/services/api';

export const actions: Actions = {
	checkDebt: async ({ request, fetch }) => {
		const formData = await request.formData();
		const phoneNumber = formData.get('phoneNumber') as string;

		if (!phoneNumber || phoneNumber.length < 9) {
			return fail(400, {
				error: 'Phone number must be at least 9 digits',
				phoneNumber
			});
		}

		try {
			const api = createTreatyClient(fetch);
			const { data, error } = await api.v1.public['check-debt'].get({
				query: { phoneNumber }
			});

			if (error) {
				const errVal = error.value as Record<string, unknown>;
				return fail(typeof error.status === 'number' ? error.status : 500, {
					error: (errVal?.message as string) || 'Failed to check debt status',
					phoneNumber
				});
			}

			return {
				success: true,
				result: (data as any) || {
					success: false,
					phone: '',
					found: false,
					count: 0
				},
				phoneNumber
			};
		} catch {
			return fail(503, {
				error: 'Unable to connect to server. Please try again later.',
				phoneNumber
			});
		}
	}
};
