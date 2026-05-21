import type { PageServerLoad } from './$types';
import { unwrapData } from '$lib/services/api-helpers';

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
		const { data, error } = await locals.api.health.json.get();

		if (error) {
			return {
				health: null as HealthData | null,
				error: 'Failed to fetch system stats'
			};
		}

		const health = unwrapData<HealthData>(data);
		if (!health) {
			return {
				health: null as HealthData | null,
				error: 'Failed to fetch system stats'
			};
		}

		return {
			health,
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
