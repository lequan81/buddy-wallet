import type { PageServerLoad } from './$types';
import { API_URL } from '$lib/api';

export const load: PageServerLoad = async ({ fetch }) => {
	try {
		const res = await fetch(`${API_URL}/v1/traces`);
		const traces = await res.json();

		return {
			traces: traces.data || []
		};
	} catch (_) {
		return {
			traces: [],
			error: 'Failed to fetch traces'
		};
	}
};
