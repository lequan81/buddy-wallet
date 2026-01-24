import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	return {
		theme: locals.theme,
		user: locals.user,
		apiOffline: locals.apiOffline,
		layout: undefined as 'blank' | 'guest' | 'authed' | undefined
	};
};
