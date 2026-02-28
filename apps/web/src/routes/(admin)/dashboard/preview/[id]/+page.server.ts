import type { PageServerLoad } from './$types';
import { error, type HttpError } from '@sveltejs/kit';
import { API_URL, getAuthHeaders } from '$lib/api';

export const load: PageServerLoad = async ({ params, fetch, cookies: _cookies, locals }) => {
	const { id } = params;
	
	if (!locals.accessToken) {
		throw error(401);
	}
	
	const headers = getAuthHeaders(locals.accessToken);
	
	try {
		// Fetch the import log details
		const response = await fetch(`${API_URL}/v1/import/logs/${id}`, {
			method: 'GET',
			headers
		});

		if (!response.ok) {
			if (response.status === 404) {
				throw error(404);
			}
			throw error(500);
		}

		const data = await response.json();
		const importLog = data.data;

		// If the import is still pending/processing, also fetch current progress
		let progress = null;
		if (importLog?.status === 'pending' || importLog?.status === 'processing') {
			const progressRes = await fetch(`${API_URL}/v1/import/progress/${id}`, {
				method: 'GET',
				headers
			});
			if (progressRes.ok) {
				const progressData = await progressRes.json();
				progress = progressData.data;
			}
		}

		return {
			importLog: importLog || null,
			progress,
			jobId: id
		};
	} catch (err) {
		console.error('Failed to load import preview:', err);
		if (err && typeof err === 'object' && 'status' in err) {
			throw err as HttpError;
		}
		throw error(500);
	}
};
