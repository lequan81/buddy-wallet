import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params }) => {
	const { data, error } = await locals.api.v1.import.export({ id: params.id }).get();

	if (error) {
		return new Response(
			JSON.stringify({ error: error.value?.message || 'Failed to fetch export data' }),
			{
				status: typeof error.status === 'number' ? error.status : 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}

	// Return as blob/file for download
	const responseData = data as any;
	if (responseData instanceof Blob) {
		return new Response(responseData, {
			headers: {
				'Content-Type': responseData.type || 'application/octet-stream',
				'Content-Disposition': `attachment; filename="export-${params.id}.json"`
			}
		});
	}

	return new Response(JSON.stringify(responseData), {
		headers: { 'Content-Type': 'application/json' }
	});
};
