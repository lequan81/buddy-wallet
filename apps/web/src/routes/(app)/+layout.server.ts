import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	// Return user if available, but don't redirect
	// Individual protected routes handle their own authentication
	return { user: locals.user };
};
