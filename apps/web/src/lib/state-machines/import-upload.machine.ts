import type { UploadState } from '$lib/types';

export interface ImportUploadTransition {
	from: UploadState['status'];
	to: UploadState['status'];
	allowed: boolean;
	reason?: string;
}

const TRANSITIONS: Record<UploadState['status'], UploadState['status'][]> = {
	idle: ['uploading'],
	uploading: ['uploaded', 'preview-loading', 'error'],
	uploaded: ['preview-loading', 'preview-ready', 'error'],
	'preview-loading': ['preview-ready', 'error', 'idle'],
	'preview-ready': ['idle', 'uploading', 'error'],
	error: ['idle', 'uploading']
};

export function transitionImportUploadState(
	fromState: UploadState['status'],
	toState: UploadState['status']
): ImportUploadTransition {
	if (fromState === toState) {
		return { from: fromState, to: toState, allowed: true };
	}

	if (TRANSITIONS[fromState].includes(toState)) {
		return { from: fromState, to: toState, allowed: true };
	}

	return {
		from: fromState,
		to: fromState,
		allowed: false,
		reason: `Invalid upload transition ${fromState} -> ${toState}`
	};
}
