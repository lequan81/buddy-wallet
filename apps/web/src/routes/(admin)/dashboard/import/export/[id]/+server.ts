import type { RequestHandler } from './$types';
import { extractApiData, extractApiErrorMessage } from '$lib/services/api-envelope';

export const GET: RequestHandler = async ({ locals, params }) => {
	try {
		const { data, error } = await locals.api.v1.data.import({ id: params.id }).progress.get();
		if (error) {
			return new Response(
				JSON.stringify({ error: extractApiErrorMessage(error.value, 'Failed to fetch import log') }),
				{
					status: typeof error.status === 'number' ? error.status : 500,
					headers: { 'Content-Type': 'application/json' }
				}
			);
		}

		const parsed = extractApiData<Record<string, unknown>>(data);
		const logData = parsed.data ?? {};
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
