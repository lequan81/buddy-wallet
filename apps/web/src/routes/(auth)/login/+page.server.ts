import type { PageServerLoad } from './$types';
import { getParam, getBoolParam } from '$lib/services/navigation';

export const load: PageServerLoad = async ({ url }) => {
	const redirectTo = getParam(url, 'redirectTo', '/');
	const registered = getBoolParam(url, 'registered');
	const verified = getBoolParam(url, 'verified');
	
	return {
		layout: 'guest',
		redirectTo,
		registered,
		verified
	};
};

