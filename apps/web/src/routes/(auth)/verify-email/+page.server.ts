import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createTreatyClient } from '$lib/services/api';
import { extractApiErrorMessage } from '$lib/services/api-envelope';

export const load: PageServerLoad = async ({ cookies }) => {
	const email = cookies.get('pending_verification_email');
	if (!email) {
		// No pending email verification — redirect to login
		throw redirect(303, '/login');
	}
	return {
		email,
		layout: 'guest'
	};
};

export const actions: Actions = {
	/**
	 * Verify OTP — POST /v1/auth/verify-otp
	 * Public endpoint, no auth required
	 */
	verify: async ({ request, fetch, cookies }) => {
		const formData = await request.formData();
		const otp = formData.get('otp') as string;
		const email = cookies.get('pending_verification_email');

		if (!email) {
			return fail(400, { message: 'No pending verification. Please sign up again.' });
		}

		if (!otp || otp.length !== 6) {
			return fail(400, { message: 'Please enter a valid 6-digit code', otp });
		}

		try {
			const api = createTreatyClient(fetch);
			const { error } = await api.v1.auth['verify-email'].post({
				token: otp
			});

			if (error) {
				const errorMessage = extractApiErrorMessage(error.value, 'Verification failed');
				return fail(400, { message: errorMessage, otp });
			}

			// Success! Clear the cookie and redirect to login with success flag
			cookies.delete('pending_verification_email', { path: '/' });
			throw redirect(303, '/login?verified=true');
		} catch (err) {
			if (err && typeof err === 'object' && 'status' in err) {
				throw err; // Re-throw redirect
			}
			return fail(503, { message: 'Unable to connect to server. Please try again.' });
		}
	},

	/**
	 * Skip verification — redirect to login
	 */
	skip: async ({ cookies }) => {
		cookies.delete('pending_verification_email', { path: '/' });
		throw redirect(303, '/login');
	}
};
