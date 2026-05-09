import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createTreatyClient } from '$lib/services/api';
import { extractApiErrorMessage } from '$lib/services/api-envelope';

export const load: PageServerLoad = async () => {
	return {
		layout: 'guest'
	};
};

export const actions: Actions = {
	default: async ({ request, fetch }) => {
		const formData = await request.formData();
		const email = formData.get('email') as string;
		const phoneNumber = formData.get('phoneNumber') as string;

		if (!email || !phoneNumber) {
			return fail(400, { message: 'Email and phone number are required' });
		}

		try {
			const api = createTreatyClient(fetch);
			const { error } = await api.v1.auth['request-password-reset'].post({
				identifier: email
			});

			if (error) {
				const errorMessage = extractApiErrorMessage(error.value, 'Request failed');
				return fail(400, { message: errorMessage });
			}

			// Always return success to prevent user enumeration
			return { success: true };
		} catch (_err) {
			return fail(503, { message: 'Unable to connect to server. Please try again later.' });
		}
	}
};
