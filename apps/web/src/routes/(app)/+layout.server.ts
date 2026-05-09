import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	// Pass user state and cookie-sniff signal to client for conditionally rendering UI
	return {
		user: locals.user,
		hasSession: locals.hasSession
	};
};
