import { SvelteMap } from 'svelte/reactivity';
import { api } from '$lib/services/api';
import type { ImportProgress, ProgressResult } from '@repo/types/core/import';
import type { ImportJob } from '@repo/types/infrastructure/jobs';
import {
	normalizeImportWorkflowState,
	isImportWorkflowTerminal,
	transitionImportWorkflow
} from '$lib/state-machines/import-workflow.machine';

/**
 * Import Progress Store — HTTP Polling only
 *
 * Uses the existing `/progress-batch` endpoint to poll for job status
 * every 3 seconds. No WebSocket connection needed — this approach is:
 *  - More scalable (no persistent connections per user)
 *  - More reliable (works across proxies, firewalls, mobile networks)
 *  - Simpler to debug and maintain
 */
class ImportProgressStore {
	activeJobs = new SvelteMap<string, ImportJob>();
	fileCache = new Map<string, File>();
	private pollingInterval: ReturnType<typeof setInterval> | undefined;
	private sseSource: EventSource | undefined;

	addJob(jobId: string, type: 'preview' | 'import', fileName: string, file?: File) {
		const initialTransition = transitionImportWorkflow('pending', 'pending');
		const status = initialTransition.to as ImportJob['status'];
		const now = new Date();

		this.activeJobs.set(jobId, {
			id: jobId,
			jobId,
			type,
			fileName,
			status,
			userId: null,
			metadata: {},
			progress: { current: 0, total: 0, percentage: 0 },
			createdAt: now,
			updatedAt: now
		});
		if (file) {
			this.fileCache.set(jobId, file);
		}
		this.startMonitoring();
	}

	/** Decide between SSE (primary) or Polling (fallback) */
	private startMonitoring() {
		const pendingIds = this.getPendingJobIds();
		if (pendingIds.length === 0) {
			this.stopMonitoring();
			return;
		}

		const url = `/v1/import/progress-sse?logIds=${pendingIds.join(',')}`;
		
		// If already monitoring these exact jobs, don't restart
		if (this.sseSource && this.sseSource.url.endsWith(url)) {
			return;
		}

		console.log(`[Import] Monitoring ${pendingIds.length} jobs...`);
		this.startSSE(url);
	}

	/** Attempt SSE connection */
	private startSSE(url: string) {
		this.stopSSE();
		this.sseSource = new EventSource(url);

		this.sseSource.onopen = () => {
			console.log('[Import] [SSE] Connected and streaming updates');
		};

		this.sseSource.onmessage = (event) => {
			try {
				const parsed = JSON.parse(event.data) as Record<string, ProgressResult>;
				// Extract data from API response format: { success: true, data: { logId: ImportProgress } }
				const progressMap: Record<string, ImportProgress> = {};
				for (const [id, result] of Object.entries(parsed)) {
					if (result && typeof result === 'object' && 'data' in result && result.data) {
						progressMap[id] = result.data as ImportProgress;
					}
				}
				console.log('[Import] [SSE] Received update for', Object.keys(progressMap).length, 'jobs');
				this.applyProgressUpdates(progressMap);
				
				// If all jobs terminal, SSE will be closed by server or we can stop
				if (this.getPendingJobIds().length === 0) {
					console.log('[Import] [SSE] All jobs completed, stopping...');
					this.stopMonitoring();
				}
			} catch (err) {
				console.error('[Import] [SSE] Error parsing message', err);
			}
		};

		this.sseSource.onerror = (err) => {
			console.warn('[Import] [SSE] Connection error, falling back to polling...', err);
			this.fallbackToPolling();
		};
	}

	/** Fallback mechanism if SSE fails */
	private fallbackToPolling() {
		this.stopSSE();
		this.startPolling();
	}

	/** Poll `/progress-batch` every 3s - fallback for SSE */
	private startPolling() {
		if (this.pollingInterval) return;

		console.log('[Import] [Polling] Started fallback polling interval (3s)');
		this.pollingInterval = setInterval(async () => {
			const pendingIds = this.getPendingJobIds();
			if (pendingIds.length === 0) {
				this.stopMonitoring();
				return;
			}

			try {
				const { data, error } = await api.v1.import['progress-batch'].post({
					logIds: pendingIds
				});

				if (!error && data) {
					console.log('[Import] [Polling] Batch update received');
					// Handle API response: could be direct object or wrapped in { data: ... }
					const result = (data as any)?.data || data as any;
					
					// Extract ImportProgress from ProgressResult union
					const progressMap: Record<string, ImportProgress> = {};
					for (const [id, item] of Object.entries(result)) {
						if (item && typeof item === 'object' && 'data' in item && item.data) {
							progressMap[id] = (item as ProgressResult).data as ImportProgress;
						} else if (item && typeof item === 'object' && 'status' in item) {
							// Direct ImportProgress format
							progressMap[id] = item as ImportProgress;
						}
					}
					this.applyProgressUpdates(progressMap);
				}
			} catch {
				// Retry silently
			}
		}, 3000);
	}

	private getPendingJobIds(): string[] {
		const pendingIds: string[] = [];
		for (const [id, job] of this.activeJobs) {
			const status = normalizeImportWorkflowState((job.status || 'pending') as string);
			if (!isImportWorkflowTerminal(status)) {
				pendingIds.push(id);
			}
		}
		return pendingIds;
	}

	private stopMonitoring() {
		this.stopSSE();
		this.stopPolling();
	}

	private stopSSE() {
		if (this.sseSource) {
			this.sseSource.close();
			this.sseSource = undefined;
			console.log('[Import] [SSE] Disconnected');
		}
	}

	private stopPolling() {
		if (this.pollingInterval) {
			clearInterval(this.pollingInterval);
			this.pollingInterval = undefined;
			console.log('[Import] [Polling] Stopped');
		}
	}

	/** Apply progress data from any source (SSE or Polling) */
	private applyProgressUpdates(data: Record<string, ImportProgress>) {
		for (const [id, result] of Object.entries(data)) {
			const job = this.activeJobs.get(id);
			if (!job) continue;

			const transition = transitionImportWorkflow(job.status as string, result.status || 'pending');
			if (!transition.allowed) {
				console.warn('[Import][FSM]', transition.reason);
			} else {
				job.status = transition.to as ImportJob['status'];
			}

			job.progress = {
				current: result.current || 0,
				total: result.total || 0,
				percentage: result.percentage || 0
			};
			job.message = result.message;

			if (job.status === 'success') {
				job.result = result.result;
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
		this.stopPolling();
	}

	removeJob(jobId: string) {
		this.activeJobs.delete(jobId);
	}

	getJob(jobId: string) {
		return this.activeJobs.get(jobId);
	}
}

export const importProgress = new ImportProgressStore();
