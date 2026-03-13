import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createTreatyClient } from '$lib/services/api';
import { superValidate, message } from 'sveltekit-superforms';
import { valibot } from 'sveltekit-superforms/adapters';
import { signupSchema } from '@repo/validation/client';

export const load: PageServerLoad = async () => {
	const form = await superValidate(valibot(signupSchema));
	return {
		form,
		layout: 'guest'
	};
};

export const actions: Actions = {
	default: async ({ request, fetch, cookies }) => {
		const form = await superValidate(request, valibot(signupSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		try {
			const api = createTreatyClient(fetch);
			const { error } = await api.v1.auth.register.post({
				name: form.data.name,
				phoneNumber: form.data.phoneNumber,
				email: form.data.email || undefined,
				password: form.data.password
			});

			if (error) {
				const errorData = error.value as { error?: { message: string } };
				let errorMessage = errorData?.error?.message || 'Registration failed';

				// Provide user-friendly messages for common errors
				if (
					errorMessage.toLowerCase().includes('already exists') ||
					errorMessage.toLowerCase().includes('duplicate')
				) {
					errorMessage =
						'An account with this phone number or email already exists. Please log in instead.';
				}

				return message(form, errorMessage, { status: 400 });
			}
		} catch (err) {
			if (err && typeof err === 'object' && 'status' in err) {
				throw err; // Re-throw redirect
			}
			console.error('[Signup] Connection Error:', String(err));
			const errorMessage =
				err instanceof Error && err.message.includes('fetch failed')
					? 'Unable to connect to API server. Please ensure the API is running on port 3000.'
					: 'Unable to connect to server. Please try again later.';
			return message(form, errorMessage, { status: 503 });
		}

		// If email provided, set cookie and redirect to verify-email
		if (form.data.email) {
			cookies.set('pending_verification_email', form.data.email, {
				path: '/',
				httpOnly: true,
				maxAge: 600 // 10 minutes
			});
			throw redirect(303, '/verify-email');
		}

		// No email (phone-only signup) — go straight to login
		throw redirect(303, '/login');
	}
};
