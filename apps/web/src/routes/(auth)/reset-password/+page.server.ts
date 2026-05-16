import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createTreatyClient } from '$lib/services/api';
import { redirect, getParam } from '$lib/services/navigation';

export const load: PageServerLoad = async ({ url }) => {
	const token = getParam(url, 'token');
	const email = getParam(url, 'email');

	if (!token || !email) {
		// If they access directly without a token, send them to forgot password
		redirect(303, '/forgot-password');
	}

	return {
		layout: 'guest',
		token,
		email
	};
};

export const actions: Actions = {
	default: async ({ request, fetch }) => {
		const formData = await request.formData();
		const email = formData.get('email') as string;
		const token = formData.get('token') as string;
		const newPassword = formData.get('newPassword') as string;

		if (!email || !token || !newPassword) {
			return fail(400, { message: 'Missing required reset fields' });
		}

		try {
			const api = createTreatyClient(fetch);
			const { error } = await api.v1.auth['reset-password'].post({
				token,
				newPassword
			});

			if (error) {
				const errorMessage = (error.value?.message || 'Invalid or expired reset link');
				return fail(400, { message: errorMessage });
			}
		} catch (_err) {
			return fail(503, { message: 'Unable to connect to server. Please try again later.' });
		}

		// On successful password reset, push back to login with a special hint query
		redirect(303, '/login', { reset: 'success' });
	}
};
