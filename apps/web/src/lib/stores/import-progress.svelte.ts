import { SvelteMap } from 'svelte/reactivity';
import { apiFetch } from '$lib/api';

export interface ImportJob {
	jobId: string;
	type: 'preview' | 'import';
	fileName: string;
	status: 'pending' | 'processing' | 'success' | 'failed';
	progress: {
		current: number;
		total: number;
		percentage: number;
	};
	result?: unknown;
	error?: string;
	message?: string;
	pollInterval?: Timer;
}

interface ProgressResponse {
	success: boolean;
	current?: number;
	total?: number;
	status: 'pending' | 'processing' | 'success' | 'failed';
	result?: unknown;
	errors?: string[];
	message?: string;
	percentage?: number;
}

class ImportProgressStore {
	// Use Svelte 5 Map for reactivity
	activeJobs = new SvelteMap<string, ImportJob>();
	private pollingTimer: Timer | undefined;

	constructor() {
		if (typeof window !== 'undefined') {
			this.startGlobalPoller();
		}
	}

	addJob(jobId: string, type: 'preview' | 'import', fileName: string) {
		console.log('[JOB STORE] Adding job:', jobId, type, fileName);
		this.activeJobs.set(jobId, {
			jobId,
			type,
			fileName,
			status: 'pending',
			progress: { current: 0, total: 0, percentage: 0 }
		});
		console.log('[JOB STORE] Active jobs count:', this.activeJobs.size);
	}

	private startGlobalPoller() {
		// Poll every 4s for ALL active jobs
		// This reduces N requests to 1 request
		this.pollingTimer = setInterval(async () => {
			if (this.activeJobs.size === 0) {
				console.log('[JOB STORE] No active jobs to poll');
				return;
			}

			// Filter only pending/processing jobs
			const jobsToPoll: string[] = [];
			for (const [id, job] of this.activeJobs) {
				if (job.status === 'pending' || job.status === 'processing') {
					jobsToPoll.push(id);
				}
			}

			console.log('[JOB STORE] Polling jobs:', jobsToPoll);

			if (jobsToPoll.length === 0) return;

			try {
				const { data } = await apiFetch<Record<string, ProgressResponse>>(
					'/v1/import/progress-batch',
					{
						method: 'POST',
						body: JSON.stringify({ logIds: jobsToPoll })
					}
				);

				console.log('[JOB STORE] Poll response:', data);

				if (!data) return;

				for (const [id, result] of Object.entries(data)) {
					const job = this.activeJobs.get(id);
					if (job) {
						job.status = result.status;
						job.progress = {
							current: result.current || 0,
							total: result.total || 0,
							percentage: result.percentage || 0
						};
						job.message = result.message;

						if (result.status === 'success') {
							job.result = result.result;
							// Don't auto-remove - let the component handle cleanup
							// Only remove preview jobs after longer delay (30s)
							if (job.type === 'preview') {
								setTimeout(() => {
									this.activeJobs.delete(id);
								}, 30000);
							}
						} else if (result.status === 'failed') {
							job.error = result.errors ? result.errors.join('; ') : 'Unknown error';
						}

						// Trigger reactivity for Svelte 5 $derived by setting a new object reference
						this.activeJobs.set(id, { ...job });
					}
				}
			} catch (err) {
				console.error('Batch polling error:', err);
			}
		}, 4000);
	}

	removeJob(jobId: string) {
		this.activeJobs.delete(jobId);
	}

	getJob(jobId: string) {
		return this.activeJobs.get(jobId);
	}
}

export const importProgress = new ImportProgressStore();
