import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params }) => {
	try {
		const { data, error } = await locals.api.v1.data.import({ id: params.id }).progress.get();
		if (error) {
			return json(
				{ error: error.value?.message || 'Failed to fetch import results' },
				{ status: typeof error.status === 'number' ? error.status : 500 }
			);
		}

		return json(data);
	} catch (error) {
		console.error('[IMPORT RESULTS ERROR]:', error);
		return json(
			{ error: 'Internal server error' },
			{ status: 500 }
		);
	}
};
