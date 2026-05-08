import type { PageServerLoad } from './$types';
import { extractApiData } from '$lib/services/api-envelope';

export const load: PageServerLoad = async ({ locals }) => {
	try {
		const debugApi = locals.api as unknown as Record<string, { get?: () => Promise<{ data?: unknown; error?: unknown }> }>;
		const { data, error } = (await debugApi['debug/traces/json']?.get?.()) || {};
		const parsed = extractApiData<{ traces?: unknown[] }>(data);

		if (error) {
			return {
				traces: [],
				error: 'Failed to fetch traces'
			};
		}

		return {
			traces: Array.isArray(parsed.data?.traces) ? parsed.data.traces : []
		};
	} catch (_) {
		return {
			traces: [],
			error: 'Failed to fetch traces'
		};
	}
};
