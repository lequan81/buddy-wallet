import { SvelteMap } from 'svelte/reactivity';
import { api } from '$lib/services/api';
import type { ImportProgress } from '@repo/types/core/import';
import type { ImportJob } from '@repo/types/infrastructure/jobs';
// Inline workflow state helpers (replaces state machine)
const WORKFLOW_TERMINAL_STATES = new Set(['success', 'failed', 'cancelled']);

const ALLOWED_WORKFLOW_TRANSITIONS: Record<string, string[]> = {
	pending: ['queued', 'processing', 'failed', 'cancelled'],
	queued: ['processing', 'failed', 'cancelled'],
	processing: ['success', 'failed', 'cancelled'],
	preview: ['success', 'failed', 'cancelled'],
	success: [],
	failed: [],
	cancelled: []
};

function normalizeStatus(state: string | undefined): string {
	if (state === 'preview' || state === 'completed') return 'success';
	if (['queued', 'processing', 'success', 'failed', 'cancelled'].includes(state ?? '')) return state!;
	return 'pending';
}

function isTerminal(state: string): boolean {
	return WORKFLOW_TERMINAL_STATES.has(normalizeStatus(state));
}

function canTransition(from: string, to: string): boolean {
	const normFrom = normalizeStatus(from);
	const normTo = normalizeStatus(to);
	if (normFrom === normTo) return true;
	return ALLOWED_WORKFLOW_TRANSITIONS[normFrom]?.includes(normTo) ?? false;
}

/**
 * Import Progress Store — XHR Polling with exponential backoff
 *
 * Uses the `/progress-poll` endpoint to poll for job status.
 * Implements exponential backoff: 1s → 2s → 4s → 8s → max 30s.
 * Uses AbortController for clean cancellation.
 *
 * No SSE/WebSocket — this approach is:
 *  - More scalable (no persistent connections per user)
 *  - More reliable (works across proxies, firewalls, mobile networks)
 *  - Simpler to debug and maintain
 */

const MIN_INTERVAL_MS = 1000;
const MAX_INTERVAL_MS = 30000;
const BACKOFF_MULTIPLIER = 2;

class ImportProgressStore {
	activeJobs = new SvelteMap<string, ImportJob>();
	fileCache = new Map<string, File>();
	private pollingTimer: ReturnType<typeof setTimeout> | undefined;
	private abortController: AbortController | undefined;
	private currentIntervalMs = MIN_INTERVAL_MS;
	private isPolling = false;

	addJob(jobId: string, type: 'preview' | 'import', fileName: string, userId: string, file?: File) {
		const status = 'pending' as ImportJob['status'];
		const now = new Date();

		this.activeJobs.set(jobId, {
			id: jobId,
			jobId,
			type,
			fileName,
			status,
			userId,
			metadata: {
				fileName,
				s3Key: '',
				totalRows: 0,
				processedRows: 0,
				successCount: 0,
				errorCount: 0
			},
			progress: { current: 0, total: 0, percentage: 0 },
			createdAt: now,
			updatedAt: now
		} as ImportJob);
		if (file) {
			this.fileCache.set(jobId, file);
		}
		this.startMonitoring();
	}

	/** Start or restart monitoring for pending jobs */
	private startMonitoring() {
		const pendingIds = this.getPendingJobIds();
		if (pendingIds.length === 0) {
			this.stopMonitoring();
			return;
		}

		if (!this.isPolling) {
			console.log(`[Import] Monitoring ${pendingIds.length} jobs...`);
			this.currentIntervalMs = MIN_INTERVAL_MS;
			this.isPolling = true;
			this.schedulePoll();
		}
	}

	/** Schedule the next poll using exponential backoff */
	private schedulePoll() {
		if (!this.isPolling) return;

		this.pollingTimer = setTimeout(async () => {
			await this.executePoll();
		}, this.currentIntervalMs);
	}

	/** Execute a single poll request */
	private async executePoll() {
		const pendingIds = this.getPendingJobIds();
		if (pendingIds.length === 0) {
			this.stopMonitoring();
			return;
		}

		// Create a new AbortController for this request
		this.abortController?.abort();
		this.abortController = new AbortController();

		try {
			
			const { data, error } = await api.v1.data.import['progress-poll'].post(
				{ logIds: pendingIds },
				{ fetch: { signal: this.abortController.signal } }
			);

			if (!error && data) {
				// Reset backoff on success
				this.currentIntervalMs = MIN_INTERVAL_MS;

				// Handle API response: unwrap { data: ... } envelope
					const result = (data as unknown as Record<string, unknown>)?.data || data;

				// Extract ImportProgress from ProgressResult union
				const progressMap: Record<string, ImportProgress> = {};
				for (const [id, item] of Object.entries(result as Record<string, unknown>)) {
					if (item && typeof item === 'object') {
						const obj = item as Record<string, unknown>;
						if ('data' in obj) {
							progressMap[id] = (obj as { data: ImportProgress }).data;
						} else if ('status' in obj) {
							progressMap[id] = obj as unknown as ImportProgress;
						}
					}
				}

				console.log('[Import] [Poll] Batch update received for', Object.keys(progressMap).length, 'jobs');
				this.applyProgressUpdates(progressMap);

				// Check meta for hasActiveJobs
					const meta = (data as unknown as Record<string, unknown>)?.meta as Record<string, unknown> | undefined;
				if (meta && meta.hasActiveJobs === false && this.getPendingJobIds().length === 0) {
					this.stopMonitoring();
					return;
				}
			}
		} catch (err: unknown) {
			if (err instanceof DOMException && err.name === 'AbortError') {
				// Request was aborted (cancelled), don't backoff
				return;
			}
			// On error, apply exponential backoff
			this.currentIntervalMs = Math.min(
				this.currentIntervalMs * BACKOFF_MULTIPLIER,
				MAX_INTERVAL_MS
			);
			console.warn(`[Import] [Poll] Error, backing off to ${this.currentIntervalMs}ms`, err);
		}

		// Continue polling if there are still pending jobs
		if (this.getPendingJobIds().length > 0) {
			this.schedulePoll();
		} else {
			this.stopMonitoring();
		}
	}

	private getPendingJobIds(): string[] {
		const pendingIds: string[] = [];
		for (const [id, job] of this.activeJobs) {
			const status = normalizeStatus((job.status || 'pending') as string);
				if (!isTerminal(status)) {
				pendingIds.push(id);
			}
		}
		return pendingIds;
	}

	private stopMonitoring() {
		this.isPolling = false;
		if (this.pollingTimer) {
			clearTimeout(this.pollingTimer);
			this.pollingTimer = undefined;
		}
		this.abortController?.abort();
		this.abortController = undefined;
		this.currentIntervalMs = MIN_INTERVAL_MS;
		console.log('[Import] [Poll] Stopped monitoring');
	}

	/** Apply progress data from poll response */
	private applyProgressUpdates(data: Record<string, ImportProgress>) {
		for (const [id, result] of Object.entries(data)) {
			const job = this.activeJobs.get(id);
			if (!job) continue;

			if (!canTransition(job.status as string, result.status || 'pending')) {
					console.warn(`[Import][FSM] Invalid transition ${job.status} -> ${result.status}`);
				} else {
					job.status = normalizeStatus(result.status || 'pending') as ImportJob['status'];
				}

			job.progress = {
				current: result.current || 0,
				total: result.total || 0,
				percentage: result.percentage || 0
			};
			job.message = result.message;

			if (job.status === 'success' && result.result) {
				if (result.result && typeof result.result === 'object' && 'data' in result.result) {
					job.result = result.result as { data: import('@repo/types/core/import').PreviewResultData };
				} else {
					job.result = { data: result.result } as { data: import('@repo/types/core/import').ImportResultData };
				}
				// Auto-cleanup preview jobs after 30s
				if (job.type === 'preview') {
					setTimeout(() => this.activeJobs.delete(id), 30000);
				}
			} else if (job.status === 'failed' || job.status === 'cancelled') {
				job.error = result.errors ? result.errors.join('; ') : 'Unknown error';
			}

			// Trigger Svelte reactivity via SvelteMap.set
			this.activeJobs.set(id, { ...job });
		}
	}

	destroy() {
		this.stopMonitoring();
	}

	removeJob(jobId: string) {
		this.activeJobs.delete(jobId);
	}

	getJob(jobId: string) {
		return this.activeJobs.get(jobId);
	}
}

export const importProgress = new ImportProgressStore();
