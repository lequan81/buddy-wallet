import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createTreatyClient } from '$lib/eden';

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
			const api = createTreatyClient(fetch);
			const { data, error, response } = await api.v1.auth.login.post({ email, password });

			if (error) {
				const errorData = error.value as { error?: { message: string } };
				const errorMessage = errorData?.error?.message || 'Login failed';
				return fail(401, { email, message: errorMessage });
			}

			if (data?.success) {
				// Forward both cookies from API to browser
				let setCookieHeaders = response.headers.getSetCookie?.() || [];

				// Fallback: If getSetCookie() returns empty array, try getting the raw header
				if (setCookieHeaders.length === 0) {
					const headerVal = response.headers.get('set-cookie');
					if (headerVal) {
						// This might be a single string or comma-separated.
						// Handling comma-separated Set-Cookie headers in a single string is difficult reliably,
						// but usually frameworks/browsers provide getSetCookie for multiple.
						// If we split by comma, we must be careful about dates.
						// For now, if getSetCookie failed, we take what we get.
						// In many environments (like Bun), getSetCookie should work.
						console.log('[LOGIN] Fallback: Found set-cookie header:', headerVal);
						setCookieHeaders = [headerVal];
					} else {
						console.log('[LOGIN] Warning: No Set-Cookie headers found in API response');
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						console.log('[LOGIN] Response Headers:', Object.fromEntries(response.headers as any));
					}
				} else {
					console.log('[LOGIN] Found cookies via getSetCookie:', setCookieHeaders);
				}

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
							path: '/', // Override path to root so hooks.server.ts sees it
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
