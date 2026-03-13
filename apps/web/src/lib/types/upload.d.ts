export interface UploadState {
	file: File | null;
	uploadId: string | null;
	previewData: string[][];
	columnHeaders: string[];
	fileName: string;
	totalRows: number;
	status: 'idle' | 'uploading' | 'uploaded' | 'preview-loading' | 'preview-ready' | 'error';
	error: string | null;
	uploadProgress: number;
}
