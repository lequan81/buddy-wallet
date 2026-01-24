import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { createApi } from '$lib/eden';

export const actions: Actions = {
	default: async ({ locals, cookies, fetch }) => {
		try {
			const api = createApi(fetch);
			// Call API to invalidate session/token
			// We pass cookies explicitly if needed, but fetch should handle it if same-origin/proxied
			// Actually Eden Treaty uses fetch, need to ensure cookies are sent.
			// SvelteKit fetch forwards cookies automatically to same-origin.
			// But API is localhost:3000.
			// We need to pass the headers manually or ensure createApi uses fetch wrapper that does it.
			// createApi in $lib/eden usually wraps fetch.

			// The API logout endpoint clears cookies on the response.
			// We need to forward those Set-Cookie headers to the browser.

			const { response } = await api.v1.auth.logout.post({});

			// Forward Set-Cookie headers (to clear cookies)
			const setCookieHeaders = response.headers.getSetCookie?.() || [];
			for (const cookieHeader of setCookieHeaders) {
				// Parse simple cookie clearing
				const nameMatch = cookieHeader.match(/^([^=]+)=/);
				if (nameMatch) {
					const name = nameMatch[1];
					// If it's a clearing cookie (max-age=0 or empty value), verify
					// Currently just forwarding logic similar to login
					// Or simpler: just use cookies.delete() manually if we know the names
					cookies.delete(name, { path: '/' });
				}
			}

			// Explicitly delete known cookies just in case API didn't return them or forwarding failed
			cookies.delete('session', { path: '/' });
			cookies.delete('refresh_token', { path: '/' });
		} catch (error) {
			console.error('Logout failed', error);
		}

		throw redirect(303, '/login');
	}
};
