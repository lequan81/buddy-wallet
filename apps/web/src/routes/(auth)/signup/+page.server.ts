import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createTreatyClient } from '$lib/eden';
import { superValidate, message } from 'sveltekit-superforms';
import { valibot } from 'sveltekit-superforms/adapters';
import { insertUserSchema } from '@repo/db/schema';

export const load: PageServerLoad = async () => {
	const form = await superValidate(valibot(insertUserSchema));
	return {
		form,
		layout: 'guest'
	};
};

export const actions: Actions = {
	default: async ({ request, fetch }) => {
		const form = await superValidate(request, valibot(insertUserSchema));

		console.log('[Signup] Form valid:', form.valid);
		console.log('[Signup] Form errors:', form.errors);
		console.log('[Signup] Form data:', form.data);

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
				console.log('[Signup] API Error:', error.value);
				const errorData = error.value as { error?: { message: string } };
				let errorMessage = errorData?.error?.message || 'Registration failed';

				// Provide user-friendly messages for common errors
				if (errorMessage.toLowerCase().includes('already exists') || errorMessage.toLowerCase().includes('duplicate')) {
					errorMessage = 'An account with this phone number or email already exists. Please log in instead.';
				}

				return message(form, errorMessage, { status: 400 });
			}
		} catch (err) {
			console.error('[Signup] Connection Error:', err);
			const errorMessage =
				err instanceof Error && err.message.includes('fetch failed')
					? 'Unable to connect to API server. Please ensure the API is running on port 3000.'
					: 'Unable to connect to server. Please try again later.';
			return message(form, errorMessage, { status: 503 });
		}

		throw redirect(303, '/login?registered=true');
	}
};
