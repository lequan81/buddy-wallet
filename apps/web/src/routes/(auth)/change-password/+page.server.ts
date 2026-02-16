import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createTreatyClient } from '$lib/eden';

export const load: PageServerLoad = async ({ url, locals }) => {
	const required = url.searchParams.get('required') === 'true';

	// If not required change and not logged in, redirect to login
	if (!required && !locals.user) {
		throw redirect(303, '/login');
	}

	return {
		layout: 'guest',
		required
	};
};

export const actions: Actions = {
	default: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const newPassword = formData.get('newPassword') as string;
		const confirmPassword = formData.get('confirmPassword') as string;

		if (!newPassword || !confirmPassword) {
			return fail(400, { message: 'All fields are required' });
		}

		if (newPassword !== confirmPassword) {
			return fail(400, { message: 'Passwords do not match' });
		}

		if (newPassword.length < 8) {
			return fail(400, { message: 'Password must be at least 8 characters' });
		}

		try {
			const api = createTreatyClient(fetch);
			const { data, error } = await api.v1.auth['force-change-password'].post({
				newPassword
			});

			if (error) {
				const errorData = error.value as { error?: { message: string } };
				const errorMessage = errorData?.error?.message || 'Password change failed';
				return fail(400, { message: errorMessage });
			}

			if (data?.success) {
				// Clear session cookies after password change
				cookies.delete('session', { path: '/' });
				cookies.delete('refresh_token', { path: '/' });

				return { success: true };
			}

			return fail(500, { message: 'Unexpected error occurred' });
		} catch (_err) {
			return fail(503, { message: 'Unable to connect to server. Please try again later.' });
		}
	}
};
