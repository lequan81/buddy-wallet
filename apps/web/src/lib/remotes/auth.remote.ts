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

		if (data && !('error' in data) && data.mustChangePassword) {
			throw redirect(303, '/change-password?required=true');

			let setCookieHeaders: string[] = response.headers.getSetCookie?.() || [];
			if (setCookieHeaders.length === 0) {
				const headerVal = response.headers.get('set-cookie');
				if (headerVal) {
					setCookieHeaders = [headerVal as string];
				}
			}

			for (const cookieHeader of setCookieHeaders) {
				const sessionMatch = cookieHeader.match(/session=([^;]+)/);
				const sessionToken = sessionMatch?.[1];
				if (sessionToken) {
					cookies.set('session', sessionToken as string, {
						path: '/',
						httpOnly: true,
						secure: import.meta.env.PROD,
						sameSite: 'lax',
						maxAge: 15 * 60
					});
				}

				const refreshMatch = cookieHeader.match(/refresh_token=([^;]+)/);
				const refreshToken = refreshMatch?.[1];
				if (refreshToken) {
					cookies.set('refresh_token', refreshToken as string, {
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
