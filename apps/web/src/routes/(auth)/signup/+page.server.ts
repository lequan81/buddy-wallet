import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createApi } from '$lib/eden';

export const load: PageServerLoad = async () => {
	return {
		layout: 'guest'
	};
};

export const actions: Actions = {
	default: async ({ request, fetch }) => {
		const formData = await request.formData();
		const name = formData.get('name') as string;
		const phoneNumber = formData.get('phoneNumber') as string;
		const email = formData.get('email') as string | null;
		const password = formData.get('password') as string;

		if (!name || !phoneNumber || !password) {
			return fail(400, {
				name,
				phoneNumber,
				email,
				message: 'Name, phone number and password are required'
			});
		}

		try {
			const api = createApi(fetch);
			const { error } = await api.v1.auth.register.post({
				name,
				phoneNumber,
				email: email || undefined,
				password
			});

			if (error) {
				return fail(400, {
					name,
					phoneNumber,
					email,
					message: error.value || 'Registration failed'
				});
			}
		} catch (_err) {
			return fail(503, {
				name,
				phoneNumber,
				email,
				message: 'Unable to connect to server. Please try again later.'
			});
		}

		throw redirect(303, '/login?registered=true');
	}
};
