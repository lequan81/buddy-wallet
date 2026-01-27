import { getContent } from '$lib/helpers';

export const prerender = true;

export const load = async () => {
	return await getContent('marketing', 'about');
};
