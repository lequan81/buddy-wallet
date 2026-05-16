import type { RequestHandler } from './$types';
import { unwrapData } from '$lib/services/api-helpers';

export const GET: RequestHandler = async ({ locals, params }) => {
	try {
		const { data, error } = await locals.api.v1.data.import({ id: params.id }).progress.get();
		if (error) {
			return new Response(
				JSON.stringify({ error: ((error.value as { message?: string })?.message || 'Failed to fetch import log') }),
				{
					status: typeof error.status === 'number' ? error.status : 500,
					headers: { 'Content-Type': 'application/json' }
				}
			);
		}

		const logData = unwrapData<Record<string, unknown>>(data) ?? {};
		// Return the log data as JSON for download
		return new Response(JSON.stringify(logData, null, 2), {
			headers: {
				'Content-Type': 'application/json',
				'Content-Disposition': `attachment; filename="import-log-${params.id}.json"`
			}
		});
	} catch (error) {
		console.error('[IMPORT EXPORT ERROR]:', error);
		return new Response(
			JSON.stringify({ error: 'Internal server error' }),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
};
