import type { PageServerLoad } from './$types';

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

		return {
			health: data as unknown as HealthData,
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
