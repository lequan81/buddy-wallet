import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createTreatyClient } from '$lib/services/api';

export const load: PageServerLoad = async ({ url }) => {
	const redirectTo = url.searchParams.get('redirectTo') || '/';
	const registered = url.searchParams.get('registered') === 'true';
	const verified = url.searchParams.get('verified') === 'true';
	return {
		layout: 'guest',
		redirectTo,
		registered,
		verified
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
			const api = createTreatyClient(fetch);
			const { data, error, response } = await api.v1.auth.login.post(
				{ email, password },
				{
					headers: {
						'User-Agent': request.headers.get('user-agent') || ''
					}
				}
			);

			if (error) {
				const errorData = error.value as { error?: { message: string } };
				const errorMessage = errorData?.error?.message || 'Login failed';
				return fail(401, { email, message: errorMessage });
			}

			if (data?.success) {
				// Check if user must change password first
				if ((data as { mustChangePassword?: boolean })?.mustChangePassword) {
					// Store a flag in session/URL and redirect to change password page
					throw redirect(303, '/change-password?required=true');
				}

				// Forward both cookies from API to browser
				let setCookieHeaders = response.headers.getSetCookie?.() || [];

				// Fallback: If getSetCookie() returns empty array, try getting the raw header
				if (setCookieHeaders.length === 0) {
					const headerVal = response.headers.get('set-cookie');
					if (headerVal) {
						setCookieHeaders = [headerVal];
					}
				}

				// Handle array of Set-Cookie headers
				for (const cookieHeader of setCookieHeaders) {
					const sessionMatch = cookieHeader.match(/session=([^;]+)/);
					if (sessionMatch) {
						cookies.set('session', sessionMatch[1], {
							path: '/',
							httpOnly: true,
							secure: import.meta.env.PROD,
							sameSite: 'lax',
							maxAge: 15 * 60 // 15 minutes
						});
					}

					const refreshMatch = cookieHeader.match(/refresh_token=([^;]+)/);
					if (refreshMatch) {
						cookies.set('refresh_token', refreshMatch[1], {
							path: '/',
							httpOnly: true,
							secure: import.meta.env.PROD,
							sameSite: 'lax',
							maxAge: 90 * 24 * 60 * 60 // 90 days
						});
					}
				}

				// Redirect to target page (hooks.server.ts will load user data)
				throw redirect(303, redirectTo);
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
