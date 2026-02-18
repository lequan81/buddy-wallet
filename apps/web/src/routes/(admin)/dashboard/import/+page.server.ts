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

		const apiBody = new FormData();
		apiBody.append('file', file);

		try {
			console.log(`[Import] Preview: ${file.name}`);

			// Note: For FormData, browser sets Content-Type with boundary automatically
			const { 'Content-Type': _, ...headersWithoutContentType } = getAuthHeaders(
				locals.accessToken
			) as Record<string, string>;
			const res = await fetch(`${API_URL}/v1/import/preview`, {
				method: 'POST',
				body: apiBody,
				headers: headersWithoutContentType
			});
			console.log(`[SvelteKit] API Status: ${res.status}`);

			const data = await res.json();
			console.log(`[SvelteKit] API Response:`, JSON.stringify(data).slice(0, 200));

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
			console.error('[Import] Preview error:', err);
			return fail(500, {
				code: FE_ERRORS.API_UNREACHABLE.code,
				message: FE_ERRORS.API_UNREACHABLE.message
			});
		}
	},

	// Import: Forward file + config to API
	import: async ({ request, fetch, locals }) => {
		const formData = await request.formData();
		const file = formData.get('file') as File;
		const configRaw = formData.get('config') as string;
		const previewLogId = formData.get('previewLogId') as string | null;

		console.log(
			`[Import] Action called. File: ${file?.name} (size: ${file?.size}, type: ${typeof file}, isFile: ${file instanceof File}), Config: ${configRaw ? 'Present' : 'Missing'}`
		);

		if (!file || file.size === 0) {
			console.error('[Import] Error: File is missing or empty');
			return fail(400, {
				code: FE_ERRORS.FILE_NOT_SELECTED.code,
				message: FE_ERRORS.FILE_NOT_SELECTED.message
			});
		}

		if (!configRaw) {
			console.error('[Import] Error: Config is missing');
			return fail(400, {
				code: FE_ERRORS.IMPORT_NO_CONFIG.code,
				message: FE_ERRORS.IMPORT_NO_CONFIG.message
			});
		}

		const apiBody = new FormData();
		apiBody.append('file', file);
		apiBody.append('config', configRaw);
		if (previewLogId) {
			apiBody.append('previewLogId', previewLogId);
		}

		try {
			console.log(
				`[Import] Sending to API: ${file.name}${previewLogId ? ` (linked to preview: ${previewLogId})` : ''}`
			);

			// Note: For FormData, browser sets Content-Type with boundary automatically
			const { 'Content-Type': _ct, ...importHeadersWithoutContentType } = getAuthHeaders(
				locals.accessToken
			) as Record<string, string>;
			const res = await fetch(`${API_URL}/v1/import/debts`, {
				method: 'POST',
				body: apiBody,
				headers: importHeadersWithoutContentType
			});

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
			console.error('[Import] Error:', err);
			return fail(500, {
				code: FE_ERRORS.API_UNREACHABLE.code,
				message: FE_ERRORS.API_UNREACHABLE.message
			});
		}
	}
};
