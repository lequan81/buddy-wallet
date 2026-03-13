import type { PageServerLoad } from './$types';
import { error, type HttpError } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { id } = params;

	if (!locals.accessToken) {
		throw error(401);
	}

	const { api } = locals;

	try {
		// Fetch the import log details
		const { data: logRes, error: logErr, status } = await api.v1.import.logs({ id }).get();

		if (logErr) {
			if (status === 404) {
				throw error(404);
			}
			throw error(500);
		}

		const importLog = logRes?.success ? logRes : null;

		// If the import is still pending/processing, also fetch current progress
		let progress = null;
		if (importLog?.status === 'pending' || importLog?.status === 'processing') {
			const { data: progressRes, error: progressErr } = await api.v1.import.progress({ logId: id }).get();
			if (!progressErr) {
				progress = progressRes?.success ? progressRes : null;
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
