import type { PageServerLoad } from './$types';
export const load: PageServerLoad = async ({ url }) => {
	const redirectTo = url.searchParams.get('redirectTo') || '/';
	const registered = url.searchParams.get('registered') === 'true';
	const verified = url.searchParams.get('verified') === 'true';
	return {
		layout: 'guest',
		redirectTo,
		registered,
		verified
	};
};

