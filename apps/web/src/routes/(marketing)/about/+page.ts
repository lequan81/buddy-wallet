import { getContent } from '$lib/helpers';

export const load = async () => {
	return await getContent('marketing', 'about');
};
