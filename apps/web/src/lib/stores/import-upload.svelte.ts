/**
 * Import Upload Store
 *
 * Svelte 5 reactive store for import upload state.
 * Replaces localStorage persistence — state survives SPA navigation
 * (module stays loaded), lost on F5 (server fallback via getLogById).
 */
import type { UploadState } from '$lib/types/import';

class ImportUploadStore {
	state = $state<UploadState>({
		file: null,
		uploadId: null,
		previewData: [],
		columnHeaders: [],
		fileName: '',
		totalRows: 0,
		status: 'idle',
		error: null,
		uploadProgress: 0
	});

	columnMapping = $state<Record<string, string>>({});
	startRow = $state(2);

	reset() {
		this.state = {
			file: null,
			uploadId: null,
			previewData: [],
			columnHeaders: [],
			fileName: '',
			totalRows: 0,
			status: 'idle',
			error: null,
			uploadProgress: 0
		};
		this.columnMapping = {};
		this.startRow = 2;
	}
}

export const importUpload = new ImportUploadStore();
