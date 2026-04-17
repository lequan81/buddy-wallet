import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params }) => {
	try {
		// Call the correct API endpoint: GET /api/v1/import/logs/:id
				const { data, error } = await locals.api.v1.import.logs({ id: params.id }).get();
		if (error) {
			return new Response(
				JSON.stringify({ error: error.value?.message || 'Failed to fetch import log' }),
				{
					status: typeof error.status === 'number' ? error.status : 500,
					headers: { 'Content-Type': 'application/json' }
				}
			);
		}

		// Return the log data as JSON for download
		return new Response(JSON.stringify(data, null, 2), {
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
