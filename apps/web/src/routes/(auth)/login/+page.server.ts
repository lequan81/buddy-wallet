import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createApi } from '$lib/eden';

export const load: PageServerLoad = async ({ url }) => {
	const redirectTo = url.searchParams.get('redirectTo') || '/';
	const registered = url.searchParams.get('registered') === 'true';
	return {
		layout: 'guest',
		redirectTo,
		registered
	};
};

export const actions: Actions = {
	default: async ({ request, fetch, url, cookies }) => {
		const formData = await request.formData();
		const email = formData.get('email') as string;
		const password = formData.get('password') as string;
		const redirectTo = url.searchParams.get('redirectTo') || '/';

		if (!email || !password) {
			return fail(400, { email, message: 'Email or Phone Number and password are required' });
		}

		try {
			const api = createApi(fetch);
			const { data, error, response } = await api.v1.auth.login.post({ email, password });

			if (error) {
				const errorMessage =
					typeof error.value === 'object' && error.value !== null
						? (error.value as { error?: string }).error || 'Login failed'
						: String(error.value);
				return fail(401, { email, message: errorMessage });
			}

			if (data?.success) {
				// Forward both cookies from API to browser
				const setCookieHeaders = response.headers.getSetCookie?.() || [];

				// Handle array of Set-Cookie headers
				for (const cookieHeader of setCookieHeaders) {
					const sessionMatch = cookieHeader.match(/session=([^;]+)/);
					if (sessionMatch) {
						cookies.set('session', sessionMatch[1], {
							path: '/',
							httpOnly: true,
							secure: process.env.NODE_ENV === 'production',
							sameSite: 'strict',
							maxAge: 15 * 60 // 15 minutes
						});
					}

					const refreshMatch = cookieHeader.match(/refresh_token=([^;]+)/);
					if (refreshMatch) {
						cookies.set('refresh_token', refreshMatch[1], {
							path: '/',
							httpOnly: true,
							secure: process.env.NODE_ENV === 'production',
							sameSite: 'strict',
							maxAge: 90 * 24 * 60 * 60 // 90 days
						});
					}
				}

				// Redirect with success param for toast
				const successUrl = redirectTo === '/' ? '/?login=success' : redirectTo;
				throw redirect(303, successUrl);
			}

			return fail(500, { email, message: 'Unexpected error occurred' });
		} catch (err) {
			// Check if it's a redirect (which is also thrown)
			if (err && typeof err === 'object' && 'status' in err) {
				throw err;
			}
			return fail(503, { email, message: 'Unable to connect to server. Please try again later.' });
		}
	}
};
