import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import { createTreatyClient } from '$lib/services/api';
import { extractApiData, extractApiErrorMessage } from '$lib/services/api-envelope';

interface CheckDebtPayload {
	hasDebts: boolean;
	phone: string;
}

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
			const { data, error } = await api['check-debt'].get({
				query: { phone: phoneNumber }
			});

			if (error) {
				return fail(typeof error.status === 'number' ? error.status : 500, {
					error: extractApiErrorMessage(error.value, 'Failed to check debt status'),
					phoneNumber
				});
			}

			const parsed = extractApiData<CheckDebtPayload>(data);
			const result = parsed.data ?? {
				hasDebts: false,
				phone: ''
			};

			return {
				success: true,
				result,
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
