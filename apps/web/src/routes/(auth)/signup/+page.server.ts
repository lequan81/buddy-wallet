import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createTreatyClient } from '$lib/services/api';
import { redirect } from '$lib/services/navigation';
import { superValidate, message } from 'sveltekit-superforms';
import { typebox } from 'sveltekit-superforms/adapters';
import type { TSchema } from '@sinclair/typebox';
import { registerRequestSchema, type RegisterRequest } from '@repo/schema/dto/auth';

// Cast needed: @repo/schema uses @sinclair/typebox (v0.34) while superforms
// expects `typebox` (v1.0+). Runtime behavior is identical.
const adapter = typebox(registerRequestSchema as unknown as TSchema & { '~kind': string });

export const load: PageServerLoad = async () => {
	const form = await superValidate(adapter);
	return {
		form,
		layout: 'guest'
	};
};

export const actions: Actions = {
	default: async ({ request, fetch, cookies }) => {
		const form = await superValidate(request, adapter);

		if (!form.valid) {
			return fail(400, { form });
		}

		try {
			const data = form.data as RegisterRequest;
			const api = createTreatyClient(fetch);
			const { error } = await api.v1.auth.register.post({
				fullName: data.name,
				phone: data.phoneNumber,
				email: data.email || undefined,
				password: data.password
			});

			if (error) {
				let errorMessage = (error.value?.message || 'Registration failed');

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
		const email = (form.data as RegisterRequest).email;
		if (email) {
			cookies.set('pending_verification_email', email, {
				path: '/',
				httpOnly: true,
				maxAge: 600 // 10 minutes
			});
			redirect(303, '/verify-email');
		}

		// No email (phone-only signup) — go straight to login
		redirect(303, '/login');
	}
};
