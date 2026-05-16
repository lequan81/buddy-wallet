import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { unwrapData } from '$lib/services/api-helpers';

export const GET: RequestHandler = async ({ locals, params }) => {
	try {
		const { data, error } = await locals.api.v1.data.import({ id: params.id }).progress.get();
		if (error) {
			return json(
				{ error: ((error.value as { message?: string })?.message || 'Failed to fetch import results') },
				{ status: typeof error.status === 'number' ? error.status : 500 }
			);
		}

		const result = unwrapData<Record<string, unknown>>(data) ?? {};
		return json(result);
	} catch (error) {
		console.error('[IMPORT RESULTS ERROR]:', error);
		return json(
			{ error: 'Internal server error' },
			{ status: 500 }
		);
	}
};
