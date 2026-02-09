import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	// Pass user state to client to conditionally render UI
	return {
		user: locals.user
	};
};
