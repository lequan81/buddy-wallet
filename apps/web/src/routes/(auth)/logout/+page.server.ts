import { redirect, fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import { API_URL, getDefaultHeaders } from '$lib/api';

export const actions: Actions = {
	default: async ({ locals, cookies, request }) => {
		// Security: Verify user is logged in before logout
		if (!locals.user) {
			// Already logged out or never logged in
			throw redirect(303, '/login');
		}

		// Security: Verify Origin header to prevent CSRF
		const origin = request.headers.get('origin');
		const host = request.headers.get('host');
		if (origin && host && !origin.includes(host.split(':')[0])) {
			return fail(403, { message: 'Invalid origin' });
		}

		try {
			// Build cookie header from all cookies (includes session + refresh_token)
			const cookieHeader = cookies.getAll().map(c => `${c.name}=${c.value}`).join('; ');

			// Security: Include both cookies in request for server-side validation
			const response = await fetch(`${API_URL}/v1/auth/logout`, {
				method: 'POST',
				headers: {
					...getDefaultHeaders(),
					Cookie: cookieHeader,
					// Forward origin for backend CSRF validation
					...(origin ? { Origin: origin } : {})
				}
			});

			if (!response.ok) {
				console.error('[AUTH] Logout failed:', await response.text());
			}
		} catch (error) {
			console.error('[AUTH] Logout error:', error);
		}

		// Always clear cookies on frontend regardless of backend response
		cookies.delete('session', { path: '/' });
		cookies.delete('refresh_token', { path: '/' });

		throw redirect(303, '/login?reason=logout');
	}
};
