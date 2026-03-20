import type { PageServerLoad } from './$types';
export const load: PageServerLoad = async ({ parent }) => {
	// Auth is handled by layout - just get user from parent
	const { user } = await parent();
	return { user };
};

