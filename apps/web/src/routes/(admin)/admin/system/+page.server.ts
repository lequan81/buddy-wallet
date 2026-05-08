import type { PageServerLoad } from './$types';
import { extractApiData } from '$lib/services/api-envelope';

interface HealthData {
	status: string;
	version: string;
	uptime: number;
	activeSessions?: { count: number };
	memory?: { heapUsed: number; rss: number };
	otel?: { enabled: boolean };
}

export const load: PageServerLoad = async ({ locals }) => {
	try {
		const { data, error } = await locals.api.health.get();

		if (error) {
			return {
				health: null as HealthData | null,
				error: 'Failed to fetch system stats'
			};
		}

		const parsed = extractApiData<HealthData>(data);
		if (!parsed.data) {
			return {
				health: null as HealthData | null,
				error: 'Failed to fetch system stats'
			};
		}

		return {
			health: parsed.data,
			lastUpdated: new Date().toISOString()
		};
	} catch (err) {
		console.error('Failed to fetch system stats', err);
		return {
			health: null as HealthData | null,
			error: 'Failed to fetch system stats'
		};
	}
};
