import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { FE_ERRORS } from '@repo/errors';
import { isValidImportFile, ACCEPTED_IMPORT_EXTENSIONS } from '@repo/config';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(303, '/login');
	return {
		acceptedFormats: ACCEPTED_IMPORT_EXTENSIONS
	};
};

export const actions: Actions = {
	// Preview: Forward file to API for parsing
	preview: async ({ request, fetch }) => {
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

		const cookie = request.headers.get('cookie') || '';
		const apiBody = new FormData();
		apiBody.append('file', file);

		try {
			console.log(`[Import] Preview: ${file.name}`);

			const res = await fetch('http://localhost:3000/v1/import/preview', {
				method: 'POST',
				body: apiBody,
				headers: { cookie }
			});
			console.log(`[SvelteKit] API Status: ${res.status}`);

			const data = await res.json();
			console.log(`[SvelteKit] API Response received (rows: ${data.totalRows})`);

			if (!res.ok) {
				return fail(res.status, {
					code: data.code || FE_ERRORS.IMPORT_PREVIEW_FAILED.code,
					message: data.message || FE_ERRORS.IMPORT_PREVIEW_FAILED.message
				});
			}

			return {
				preview: true,
				logId: data.logId,
				fileName: data.fileName,
				totalRows: data.totalRows,
				columnHeaders: data.columnHeaders,
				previewData: data.previewData,
				autoMapping: data.autoMapping
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
	import: async ({ request, fetch }) => {
		const formData = await request.formData();
		const file = formData.get('file') as File;
		const configRaw = formData.get('config') as string;

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

		const cookie = request.headers.get('cookie') || '';
		const apiBody = new FormData();
		apiBody.append('file', file);
		apiBody.append('config', configRaw);

		try {
			console.log(`[Import] Import: ${file.name}`);

			const res = await fetch('http://localhost:3000/v1/import/debts', {
				method: 'POST',
				body: apiBody,
				headers: { cookie }
			});

			const data = await res.json();

			if (!res.ok) {
				return fail(res.status, {
					code: data.code || 'BE_UNKNOWN',
					message: data.message || 'Import failed'
				});
			}

			return {
				success: true,
				logId: data.logId,
				imported: data.imported,
				errors: data.errors
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
