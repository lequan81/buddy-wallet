import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { FE_ERRORS } from '@repo/errors';
import { isValidImportFile, ACCEPTED_IMPORT_EXTENSIONS } from '@repo/config';
import { API_URL, getAuthHeaders } from '$lib/api';

export const load: PageServerLoad = async ({ parent }) => {
	// Get server-computed permissions from layout
	const { permissions } = await parent();

	// Only users with canImportData can access
	if (!permissions.canImportData) {
		throw redirect(303, '/dashboard');
	}

	return {
		acceptedFormats: ACCEPTED_IMPORT_EXTENSIONS
	};
};

export const actions: Actions = {
	// Preview: Forward file to API for parsing
	preview: async ({ request, fetch, locals }) => {
		try {
			console.log(`[Frontend-Trace] Awaiting preview formData()`);
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

			console.log(`[Frontend-Trace] Cloning preview file to RAM blob...`);
			const safeBuffer = await file.arrayBuffer();
			const safeBlob = new Blob([safeBuffer], { type: file.type });

			const apiBody = new FormData();
			// Re-attach it as a File so the backend receives the correct filename
			apiBody.append('file', new File([safeBlob], file.name, { type: file.type }));

			try {
				console.log(`[Import-Preview] Fetching Backend API: ${file.name}`);

				// Note: For FormData, browser sets Content-Type with boundary automatically
				const { 'Content-Type': _, ...headersWithoutContentType } = getAuthHeaders(
					locals.accessToken
				) as Record<string, string>;
				const res = await fetch(`${API_URL}/v1/import/preview`, {
					method: 'POST',
					body: apiBody,
					headers: headersWithoutContentType
				});
				console.log(`[SvelteKit-Preview] API Status: ${res.status}`);

				const data = await res.json();

				if (!res.ok) {
					return fail(res.status, {
						code: data.code || FE_ERRORS.IMPORT_PREVIEW_FAILED.code,
						message: data.message || FE_ERRORS.IMPORT_PREVIEW_FAILED.message
					});
				}

				return {
					success: true,
					preview: true,
					jobId: data.data?.jobId || data.jobId,
					logId: data.data?.logId || data.logId,
					fileName: data.data?.fileName || data.fileName,
					totalRows: data.data?.totalRows || data.totalRows,
					columnHeaders: data.data?.columnHeaders || data.columnHeaders,
					previewData: data.data?.previewData || data.previewData,
					autoMapping: data.data?.autoMapping || data.autoMapping
				};
			} catch (err) {
				console.error('[FRONTEND SVELTEKIT CRASH - PREVIEW FETCH]:', err);
				return fail(500, {
					code: FE_ERRORS.API_UNREACHABLE.code,
					message: FE_ERRORS.API_UNREACHABLE.message
				});
			}
		} catch (outerErr) {
			console.error('[FRONTEND SVELTEKIT CRASH - PREVIEW INIT]:', outerErr);
			return fail(500, {
				code: 'BE_UNKNOWN',
				message: `SvelteKit File Parsing Failed: ${outerErr instanceof Error ? outerErr.message : String(outerErr)}`
			});
		}
	},

	// Import: Forward file + config to API
	import: async ({ request, fetch, locals }) => {
		try {
			console.log(`[Import-Trace] 1. Awaiting request.formData()`);
			const formData = await request.formData();

			console.log(`[Import-Trace] 2. Extracting file from formData`);
			const file = formData.get('file') as File;
			const configRaw = formData.get('config') as string;
			const previewLogId = formData.get('previewLogId') as string | null;

			console.log(
				`[Import-Trace] 3. Validating file: ${file?.name} (size: ${file?.size}, type: ${typeof file}, isFile: ${file instanceof File})`
			);

			if (!file || file.size === 0) {
				console.error('[Import-Trace] Error: File is missing or empty');
				return fail(400, {
					code: FE_ERRORS.FILE_NOT_SELECTED.code,
					message: FE_ERRORS.FILE_NOT_SELECTED.message
				});
			}

			if (!configRaw) {
				console.error('[Import-Trace] Error: Config is missing');
				return fail(400, {
					code: FE_ERRORS.IMPORT_NO_CONFIG.code,
					message: FE_ERRORS.IMPORT_NO_CONFIG.message
				});
			}

			console.log(`[Import-Trace] 4. Cloning SvelteKit volatile file into RAM BLOB...`);
			const safeBuffer = await file.arrayBuffer();
			console.log(`[Import-Trace] 5. Cloned ${safeBuffer.byteLength} bytes. Creating BLOB.`);
			const safeBlob = new Blob([safeBuffer], { type: file.type });

			const apiBody = new FormData();
			// Re-attach it as a File so the backend receives the correct filename
			apiBody.append('file', new File([safeBlob], file.name, { type: file.type }));
			apiBody.append('config', configRaw);
			if (previewLogId) {
				apiBody.append('previewLogId', previewLogId);
			}

			console.log(`[Import-Trace] 6. Constructing fetch API body`);

			try {
				console.log(`[Import] SvelteKit preparing to fetch API: ${file.name}`);

				// Note: For FormData, browser sets Content-Type with boundary automatically
				const { 'Content-Type': _ct, ...importHeadersWithoutContentType } = getAuthHeaders(
					locals.accessToken
				) as Record<string, string>;

				const res = await fetch(`${API_URL}/v1/import/debts`, {
					method: 'POST',
					body: apiBody,
					headers: importHeadersWithoutContentType
				});

				console.log(`[Import] SvelteKit API fetch returned status ${res.status}`);

				const data = await res.json();

				if (!res.ok) {
					console.error(`[Import] API Error (${res.status}):`, JSON.stringify(data));
					return fail(res.status, {
						code: data.code || 'BE_UNKNOWN',
						message: data.message || 'Import failed'
					});
				}

				console.log('[Import] Success:', data);
				return {
					success: true,
					jobId: data.data?.jobId || data.jobId,
					logId: data.data?.logId || data.logId,
					imported: data.data?.imported || data.imported,
					errors: data.data?.errors || data.errors
				};
			} catch (err) {
				console.error('[Import] SVELTEKIT FETCH CRASH:', err);
				return fail(500, {
					code: FE_ERRORS.API_UNREACHABLE.code,
					message: `SvelteKit upload failed: ${err instanceof Error ? err.message : String(err)}`
				});
			}
		} catch (outerErr) {
			console.error('[Import-Trace] SVELTEKIT OUTER CRASH:', outerErr);
			return fail(500, {
				code: FE_ERRORS.API_UNREACHABLE.code,
				message: `SvelteKit parsing failed: ${outerErr instanceof Error ? outerErr.message : String(outerErr)}`
			});
		}
	}
};
