import { form, getRequestEvent } from '$app/server';
import { invalid, redirect } from '@sveltejs/kit';
import { createTreatyClient } from '$lib/services/api';
import { loginSchema } from '@repo/validation/client';

export const loginRemote = form(loginSchema, async ({ email, password }) => {
	const event = getRequestEvent();
	const { request, fetch, cookies, url } = event;
	const redirectTo = url.searchParams.get('redirectTo') || '/';

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
			invalid(errorMessage);
		}

		if (data) {
			if (data.mustChangePassword) {
				throw redirect(303, '/change-password?required=true');
			}

			let setCookieHeaders = response.headers.getSetCookie?.() || [];
			if (setCookieHeaders.length === 0) {
				const headerVal = response.headers.get('set-cookie');
				if (headerVal) {
					setCookieHeaders = [headerVal];
				}
			}

			for (const cookieHeader of setCookieHeaders) {
				const sessionMatch = cookieHeader.match(/session=([^;]+)/);
				if (sessionMatch) {
					cookies.set('session', sessionMatch[1], {
						path: '/',
						httpOnly: true,
						secure: import.meta.env.PROD,
						sameSite: 'lax',
						maxAge: 15 * 60
					});
				}

				const refreshMatch = cookieHeader.match(/refresh_token=([^;]+)/);
				if (refreshMatch) {
					cookies.set('refresh_token', refreshMatch[1], {
						path: '/',
						httpOnly: true,
						secure: import.meta.env.PROD,
						sameSite: 'lax',
						maxAge: 90 * 24 * 60 * 60
					});
				}
			}

			throw redirect(303, redirectTo);
		}

		invalid('Unexpected error occurred');
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}
		invalid('Unable to connect to server. Please try again later.');
	}
});
