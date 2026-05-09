import { form, getRequestEvent } from '$app/server';
import { invalid, redirect } from '@sveltejs/kit';
import { createTreatyClient } from '$lib/services/api';
import { extractApiData, extractApiErrorMessage } from '$lib/services/api-envelope';
import { loginRequestSchema as loginSchema } from '@repo/schema/dto/auth';
import { toStandardSchema } from '@repo/schema/adapters/standard-schema';

export const loginRemote = form(toStandardSchema(loginSchema), async ({ email, password }) => {
	const event = getRequestEvent();
	const { request, fetch, cookies, url } = event;
	const redirectTo = url.searchParams.get('redirectTo') || '/';

	try {
		const api = createTreatyClient(fetch);
		const { data, error, response } = await api.v1.auth.login.post(
			{ identifier: email, password },
			{
				headers: {
					'User-Agent': request.headers.get('user-agent') || ''
				}
			}
		);

		if (error) {
			invalid(extractApiErrorMessage(error.value, 'Login failed'));
		}

		if (data && !('error' in data)) {
			const parsed = extractApiData<{ mustChangePassword?: boolean }>(data);

			// Extract and set session cookies from the API response
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

			// If user must change password, redirect to change-password page
			if (parsed.data?.mustChangePassword) {
				throw redirect(303, '/change-password?required=true');
			}

			// Normal successful login — redirect to destination
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
