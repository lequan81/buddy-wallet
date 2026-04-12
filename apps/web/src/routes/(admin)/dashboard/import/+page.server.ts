import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { FE_ERRORS } from '@repo/errors';
import { isValidImportFile, ACCEPTED_IMPORT_EXTENSIONS } from '@repo/config/shared';

export const load: PageServerLoad = async ({ parent, locals, url }) => {
	// Get server-computed permissions from layout
	const { permissions } = await parent();

	const historyPageRaw = Number(url.searchParams.get('historyPage') || '1');
	const historyPage = Number.isFinite(historyPageRaw) && historyPageRaw > 0 ? historyPageRaw : 1;

	// Only users with canImportData can access
	if (!permissions.canImportData) {
		if (locals.apiOffline) {
			return {
				acceptedFormats: ACCEPTED_IMPORT_EXTENSIONS,
				logs: [],
				historyTotalPages: 1,
				historyPage,
				error: 'Backend API is unavailable'
			};
		}

		throw redirect(303, '/dashboard');
	}

	// Fetch selected history page
	let logs: unknown[] = [];
	let historyTotalPages = 1;

	try {
		const { data, error } = await locals.api.v1.import.logs.get({
			query: { page: String(historyPage), limit: '10' }
		});
		if (!error && data) {
			logs = Array.isArray(data.items) ? data.items : [];
			const pagination = data.pagination;
			if (pagination) {
				historyTotalPages = Math.ceil(pagination.total / pagination.limit) || 1;
			}
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
	// Preview: Forward file to API for parsing
	preview: async ({ request, locals }) => {
		try {
			const formData = await request.formData();
			const file = formData.get('file') as File;

			if (!file || file.size === 0) {
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

			// Clone file to RAM blob to prevent SvelteKit stream consumption issues
			const safeBuffer = await file.arrayBuffer();
			const safeBlob = new Blob([safeBuffer], { type: file.type });
			const safeFile = new File([safeBlob], file.name, { type: file.type });

			try {
				const { data, error } = await locals.api.v1.import.preview.post({
					file: safeFile
				});

				if (error) {
					const errVal = error.value as { code?: string; message?: string };
					return fail(typeof error.status === 'number' ? error.status : 400, {
						code: errVal?.code || FE_ERRORS.IMPORT_PREVIEW_FAILED.code,
						message: errVal?.message || FE_ERRORS.IMPORT_PREVIEW_FAILED.message
					});
				}

				// Backend now returns { jobId, message } - preview is async via polling
				const res = (data || {}) as Record<string, unknown>;
				const jobId = typeof res.jobId === 'string' ? res.jobId : undefined;

				if (!jobId) {
					return fail(500, {
						code: FE_ERRORS.IMPORT_PREVIEW_FAILED.code,
						message: 'No job ID returned from server'
					});
				}

				return {
					success: true,
					preview: true,
					jobId
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

	// Import: Forward file + config to API
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

				const { data, error } = await locals.api.v1.import.debts.post(body as { file: File; config: string; previewLogId?: string });

				if (error) {
					const errVal = error.value as { code?: string; message?: string };
					return fail(typeof error.status === 'number' ? error.status : 500, {
						code: errVal?.code || 'BE_UNKNOWN',
						message: errVal?.message || 'Import failed'
					});
				}

				// Backend returns { jobId, message } - import is async via polling
				const res = (data || {}) as Record<string, unknown>;
				const jobId = typeof res.jobId === 'string' ? res.jobId : undefined;

				if (!jobId) {
					return fail(500, {
						code: 'BE_UNKNOWN',
						message: 'No job ID returned from server'
					});
				}

				return {
					success: true,
					jobId
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
