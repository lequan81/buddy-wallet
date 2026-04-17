import type {
	ImportWorkflowLegacyState,
	ImportWorkflowState,
	ImportWorkflowTransition
} from '@repo/types/infrastructure/import-workflow';

const TRANSITIONS: Record<ImportWorkflowState, ImportWorkflowState[]> = {
	pending: ['queued', 'processing', 'failed', 'cancelled'],
	queued: ['processing', 'failed', 'cancelled'],
	processing: ['success', 'failed', 'cancelled'],
	success: [],
	failed: [],
	cancelled: []
};

const TERMINAL_STATES = new Set<ImportWorkflowState>(['success', 'failed', 'cancelled']);

export function normalizeImportWorkflowState(state: ImportWorkflowLegacyState | string | undefined): ImportWorkflowState {
	if (state === 'preview' || state === 'completed') {
		return 'success';
	}

	if (state === 'queued' || state === 'processing' || state === 'success' || state === 'failed' || state === 'cancelled') {
		return state;
	}

	return 'pending';
}

export function isImportWorkflowTerminal(state: ImportWorkflowState): boolean {
	return TERMINAL_STATES.has(state);
}

export function transitionImportWorkflow(
	fromState: ImportWorkflowLegacyState | string | undefined,
	toState: ImportWorkflowLegacyState | string | undefined
): ImportWorkflowTransition {
	const from = normalizeImportWorkflowState(fromState);
	const to = normalizeImportWorkflowState(toState);

	if (from === to) {
		return { from, to, allowed: true };
	}

	if (TRANSITIONS[from].includes(to)) {
		return { from, to, allowed: true };
	}

	return {
		from,
		to: from,
		allowed: false,
		reason: `Invalid transition ${from} -> ${to}`
	};
}
