import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	try {
		const { data, error } = await locals.api.traces.json.get();

		if (error) {
			return {
				traces: [],
				error: 'Failed to fetch traces'
			};
		}

		return {
			traces: data?.traces || []
		};
	} catch (_) {
		return {
			traces: [],
			error: 'Failed to fetch traces'
		};
	}
};
