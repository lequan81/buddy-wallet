import { fail } from '@sveltejs/kit';
import { redirect, getIntParam } from '$lib/services/navigation';
import type { Actions, PageServerLoad } from './$types';
import { FE_ERRORS } from '@repo/errors/frontend';
import { isValidImportFile, ACCEPTED_IMPORT_EXTENSIONS } from '@repo/config/shared';
import type { ImportLog } from '@repo/types/core/import';
import { unwrapData, unwrapPagination } from '$lib/services/api-helpers';

interface ImportPreviewPayload {
	previewId: string;
	headers: string[];
	previewRows: Record<string, unknown>[];
	totalRows: number;
	suggestedMapping: Record<string, string>;
	fileName?: string;
}

interface ImportStartPayload {
	importId?: string;
	imported?: number;
	failed?: number;
}

export const load: PageServerLoad = async ({ parent, locals, url }) => {
	const { permissions } = await parent();

	const historyPage = getIntParam(url, 'historyPage', 1);
	const historyLimit = 10;

	if (!permissions.canImportData) {
		if (locals.apiOffline) {
			return {
				acceptedFormats: ACCEPTED_IMPORT_EXTENSIONS,
				logs: [] as ImportLog[],
				historyTotalPages: 1,
				historyPage,
				error: 'Backend API is unavailable'
			};
		}

		redirect(303, '/dashboard');
	}

	let logs: ImportLog[] = [];
	let historyTotalPages = 1;

	try {
		const { data, error } = await locals.api.v1.data.import.logs.get({
			query: { page: historyPage, limit: historyLimit }
		});
		if (!error) {
			logs = unwrapData<ImportLog[]>(data) ?? [];
			const pag = unwrapPagination(data, { page: historyPage, limit: historyLimit });
			historyTotalPages = Math.max(1, pag.totalPages || Math.ceil(pag.total / pag.limit));
		}
	} catch (err) {
		console.error('[Import] Failed to load history:', err);
	}

	return {
		acceptedFormats: ACCEPTED_IMPORT_EXTENSIONS,
		logs,
		historyTotalPages,
		historyPage
	};
};

export const actions: Actions = {
	preview: async ({ request, locals }) => {
		try {
			const formData = await request.formData();
			const file = formData.get('file');

			if (!(file instanceof File) || file.size === 0) {
				return fail(400, {
					code: FE_ERRORS.FILE_NOT_SELECTED.code,
					message: FE_ERRORS.FILE_NOT_SELECTED.message
				});
			}

			if (!isValidImportFile(file.name)) {
				return fail(400, {
					code: FE_ERRORS.FILE_INVALID_TYPE.code,
					message: `${FE_ERRORS.FILE_INVALID_TYPE.message}. Accepted: ${ACCEPTED_IMPORT_EXTENSIONS.join(', ')}`
				});
			}

			const safeBuffer = await file.arrayBuffer();
			const safeBlob = new Blob([safeBuffer], { type: file.type });
			const safeFile = new File([safeBlob], file.name, { type: file.type });

			try {
				const { data, error } = await locals.api.v1.data.import.preview.post({ file: safeFile });
				if (error) {
					return fail(typeof error.status === 'number' ? error.status : 400, {
						code: FE_ERRORS.IMPORT_PREVIEW_FAILED.code,
						message: ((error.value as { message?: string })?.message || FE_ERRORS.IMPORT_PREVIEW_FAILED.message)
					});
				}

				const previewData = unwrapData<ImportPreviewPayload>(data);
				if (!previewData?.previewId) {
					return fail(500, {
						code: FE_ERRORS.IMPORT_PREVIEW_FAILED.code,
						message: 'No preview ID returned from server'
					});
				}

				const headers = previewData.headers || [];
				const previewRows = (previewData.previewRows || []).map((row: Record<string, unknown>) =>
					headers.map((h: string) => String(row[h] ?? ''))
				);

				return {
					success: true,
					preview: true,
					jobId: previewData.previewId,
					previewData: previewRows,
					totalRows: previewData.totalRows || 0,
					columnHeaders: headers,
					autoMapping: previewData.suggestedMapping || {}
				};
			} catch (err) {
				console.error('[IMPORT PREVIEW FETCH ERROR]:', err);
				return fail(500, {
					code: FE_ERRORS.API_UNREACHABLE.code,
					message: FE_ERRORS.API_UNREACHABLE.message
				});
			}
		} catch (outerErr) {
			console.error('[IMPORT PREVIEW INIT ERROR]:', outerErr);
			return fail(500, {
				code: 'BE_UNKNOWN',
				message: `SvelteKit File Parsing Failed: ${outerErr instanceof Error ? outerErr.message : String(outerErr)}`
			});
		}
	},

	import: async ({ request, locals }) => {
		try {
			const formData = await request.formData();
			const file = formData.get('file');
			const configRaw = formData.get('config');
			const previewLogIdRaw = formData.get('previewLogId');
			const previewLogId = typeof previewLogIdRaw === 'string' ? previewLogIdRaw : null;

			if (!(file instanceof File) || file.size === 0) {
				return fail(400, {
					code: FE_ERRORS.FILE_NOT_SELECTED.code,
					message: FE_ERRORS.FILE_NOT_SELECTED.message
				});
			}

			if (typeof configRaw !== 'string' || configRaw.length === 0) {
				return fail(400, {
					code: FE_ERRORS.IMPORT_NO_CONFIG.code,
					message: FE_ERRORS.IMPORT_NO_CONFIG.message
				});
			}

			const safeBuffer = await file.arrayBuffer();
			const safeBlob = new Blob([safeBuffer], { type: file.type });
			const safeFile = new File([safeBlob], file.name, { type: file.type });

			try {
				const config = JSON.parse(configRaw) as {
					mapping?: Record<string, string>;
					startRow?: number;
				};
				const mapping = config.mapping || {};
				const startRow = config.startRow || 1;

				if (previewLogId) {
					const { data, error } = await locals.api.v1.data.import({ id: previewLogId }).start.post({
						columnMapping: mapping,
						startRow
					});

					if (error) {
						return fail(typeof error.status === 'number' ? error.status : 500, {
							code: 'BE_UNKNOWN',
							message: ((error.value as { message?: string })?.message || 'Import failed')
						});
					}

					const payload = unwrapData<ImportStartPayload>(data) ?? {};
					return {
						success: true,
						jobId: payload.importId || previewLogId,
						imported: payload.imported,
						failed: payload.failed
					};
				}

				const body = {
					file: safeFile,
					config: configRaw
				};

				// Legacy endpoint body shape differs from typed schema
				const { data, error } = await locals.api.v1.data.import.post(body as unknown as Parameters<typeof locals.api.v1.data.import.post>[0]);
				if (error) {
					return fail(typeof error.status === 'number' ? error.status : 500, {
						code: 'BE_UNKNOWN',
						message: ((error.value as { message?: string })?.message || 'Import failed')
					});
				}

				const result = unwrapData<{ importId?: string }>(data) ?? {};
				const jobId = result.importId || previewLogId;
				return { success: true, jobId };
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
