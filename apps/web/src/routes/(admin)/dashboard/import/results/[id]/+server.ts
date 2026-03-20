import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params }) => {
	const { data, error } = await (locals.api.v1.import as any).results({ id: params.id }).get();

	if (error) {
		return json(
			{ error: error.value?.message || 'Failed to fetch import results' },
			{ status: typeof error.status === 'number' ? error.status : 500 }
		);
	}

	return json(data);
};
