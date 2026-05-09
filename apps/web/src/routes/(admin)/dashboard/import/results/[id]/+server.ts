import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { extractApiData, extractApiErrorMessage } from '$lib/services/api-envelope';

export const GET: RequestHandler = async ({ locals, params }) => {
	try {
		const { data, error } = await locals.api.v1.data.import({ id: params.id }).progress.get();
		if (error) {
			return json(
				{ error: extractApiErrorMessage(error.value, 'Failed to fetch import results') },
				{ status: typeof error.status === 'number' ? error.status : 500 }
			);
		}

		const parsed = extractApiData<Record<string, unknown>>(data);
		return json(parsed.data ?? {});
	} catch (error) {
		console.error('[IMPORT RESULTS ERROR]:', error);
		return json(
			{ error: 'Internal server error' },
			{ status: 500 }
		);
	}
};
