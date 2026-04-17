import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) {
		if (locals.apiOffline) {
			return {
				apiOffline: true,
				isAuthorized: false
			};
		}

		throw redirect(302, '/login');
	}
	if (locals.user.role !== 'admin') throw redirect(303, '/dashboard');

	return {
		apiOffline: locals.apiOffline,
		isAuthorized: true
	};
};
