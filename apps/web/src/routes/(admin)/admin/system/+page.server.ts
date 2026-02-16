import type { PageServerLoad } from './$types';
import { API_URL } from '$lib/api';

export const load: PageServerLoad = async ({ fetch }) => {
	try {
		const res = await fetch(`${API_URL}/health`);
		const healthData = await res.json();

		return {
			health: healthData,
			lastUpdated: new Date().toISOString()
		};
	} catch (err) {
		console.error('Failed to fetch system stats', err);
		return {
			health: null,
			error: 'Failed to fetch system stats'
		};
	}
};
