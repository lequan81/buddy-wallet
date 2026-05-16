import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createTreatyClient } from '$lib/services/api';

export const load: PageServerLoad = async ({ cookies, locals }) => {
	// 1. If logged in and already verified, go home
	if (locals.user?.emailVerified) {
		throw redirect(303, '/');
	}

	const email = cookies.get('pending_verification_email');
	if (!email) {
		// 2. If no pending verification cookie AND not logged in, go to login
		if (!locals.user) {
			throw redirect(303, '/login');
		}
		// 3. If logged in but not verified, use their own email
		return {
			email: locals.user.email,
			layout: 'guest'
		};
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
				const errorMessage = (error.value?.message || 'Verification failed');
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
