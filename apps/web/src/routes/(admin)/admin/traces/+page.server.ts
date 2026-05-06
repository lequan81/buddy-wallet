import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	try {
		const debugApi = locals.api as unknown as Record<string, { get?: () => Promise<{ data?: unknown; error?: unknown }> }>;
		const { data, error } = (await debugApi['debug/traces/json']?.get?.()) || {};

		if (error) {
			return {
				traces: [],
				error: 'Failed to fetch traces'
			};
		}

		return {
			traces: (data && !('error' in data) ? data.traces : []) || []
		};
	} catch (_) {
		return {
			traces: [],
			error: 'Failed to fetch traces'
		};
	}
};
