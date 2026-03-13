import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ locals, cookies }) => {
		// Call backend to invalidate session
		if (locals.user) {
			try {
				await locals.api.v1.auth.logout.post();
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
