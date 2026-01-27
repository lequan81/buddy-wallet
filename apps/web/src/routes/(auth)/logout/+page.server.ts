import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { API_URL, getDefaultHeaders } from '$lib/api';

export const actions: Actions = {
	default: async ({ locals, cookies }) => {
		// Call backend to invalidate session
		if (locals.user) {
			try {
				const cookieHeader = cookies.getAll().map(c => `${c.name}=${c.value}`).join('; ');
				await fetch(`${API_URL}/v1/auth/logout`, {
					method: 'POST',
					headers: { ...getDefaultHeaders(), Cookie: cookieHeader }
				});
			} catch (error) {
				console.error('[AUTH] Logout error:', error);
			}
		}

		// Always clear cookies (defense in depth)
		cookies.delete('session', { path: '/' });
		cookies.delete('refresh_token', { path: '/' });

		redirect(303, '/login?reason=logout');
	}
};
