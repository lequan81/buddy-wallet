import type { PageServerLoad, Actions } from './$types';
import { error, fail, type HttpError } from '@sveltejs/kit';
import { FE_ERRORS } from '@repo/errors/frontend';

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

		// The successful logRes is the log object (flattened)
		const importLog = logRes as Record<string, unknown> | null;

		// If the import is still pending/processing, also fetch current progress
		let progress: Record<string, unknown> | null = null;
		if (
			importLog &&
			typeof importLog.status === 'string' &&
			(importLog.status === 'pending' ||
				importLog.status === 'queued' ||
				importLog.status === 'processing' ||
				importLog.status === 'preview')
		) {
			const { data: progressRes, error: progressErr } = await api.v1.import.progress({ logId: id }).get();
			if (!progressErr && progressRes) {
				progress = progressRes as Record<string, unknown>;
			}
		}

		return {
			importLog,
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

export const actions: Actions = {
	import: async ({ request, locals }) => {
		try {
			const formData = await request.formData();
			const file = formData.get('file') as File;
			const configRaw = formData.get('config') as string;
			const previewLogId = formData.get('previewLogId') as string | null;

			if (!file || file.size === 0) {
				return fail(400, {
					code: FE_ERRORS.FILE_NOT_SELECTED.code,
					message: FE_ERRORS.FILE_NOT_SELECTED.message
				});
			}

			if (!configRaw) {
				return fail(400, {
					code: FE_ERRORS.IMPORT_NO_CONFIG.code,
					message: FE_ERRORS.IMPORT_NO_CONFIG.message
				});
			}

			// Clone file to RAM blob to prevent SvelteKit stream consumption issues
			const safeBuffer = await file.arrayBuffer();
			const safeBlob = new Blob([safeBuffer], { type: file.type });
			const safeFile = new File([safeBlob], file.name, { type: file.type });

			try {
				const body: { file: File; config: string; previewLogId?: string } = {
					file: safeFile,
					config: configRaw
				};
				if (previewLogId) {
					body.previewLogId = previewLogId;
				}

				const { data, error } = await locals.api.v1.import.debts.post(body);

				if (error) {
					const errVal = error.value as { code?: string; message?: string };
					return fail(typeof error.status === 'number' ? error.status : 500, {
						code: errVal?.code || 'BE_UNKNOWN',
						message: errVal?.message || 'Import failed'
					});
				}

				const d = (data || {}) as Record<string, unknown>;
				return {
					success: true,
					jobId: typeof d.jobId === 'string' ? d.jobId : undefined,
					logId: typeof (d.id || d.logId) === 'string' ? (d.id || d.logId) as string : undefined,
					imported: typeof d.importedCount === 'number' ? d.importedCount : undefined,
					errors: Array.isArray(d.errors) ? (d.errors as string[]) : undefined
				};
			} catch (err) {
				console.error('[IMPORT FETCH ERROR]:', err);
				return fail(500, {
					code: FE_ERRORS.API_UNREACHABLE.code,
					message: `SvelteKit upload failed: ${err instanceof Error ? err.message : String(err)}`
				});
			}
		} catch (outerErr) {
			console.error('[IMPORT INIT ERROR]:', outerErr);
			return fail(500, {
				code: FE_ERRORS.API_UNREACHABLE.code,
				message: `SvelteKit parsing failed: ${outerErr instanceof Error ? outerErr.message : String(outerErr)}`
			});
		}
	}
};
