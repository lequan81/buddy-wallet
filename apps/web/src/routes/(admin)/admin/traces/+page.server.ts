import type { PageServerLoad } from './$types';
import { unwrapData } from '$lib/services/api-helpers';

export const load: PageServerLoad = async ({ locals }) => {
	try {
		const debugApi = locals.api as unknown as Record<string, { get?: () => Promise<{ data?: unknown; error?: unknown }> }>;
		const { data, error } = (await debugApi['debug/traces/json']?.get?.()) || {};
		const tracesData = unwrapData<{ traces?: unknown[] }>(data);

		if (error) {
			return {
				traces: [],
				error: 'Failed to fetch traces'
			};
		}

		return {
			traces: Array.isArray(tracesData?.traces) ? tracesData.traces : []
		};
	} catch (_) {
		return {
			traces: [],
			error: 'Failed to fetch traces'
		};
	}
};
