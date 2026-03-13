import { SvelteMap } from 'svelte/reactivity';
import { api } from '$lib/services/api';
import type { ImportJob, ProgressResult } from '@repo/types';


class ImportProgressStore {
	// Use Svelte 5 Map for reactivity
	activeJobs = new SvelteMap<string, ImportJob>();
	private ws: ReturnType<typeof api.v1.import['progress-ws']['subscribe']> | undefined;
	private reconnectTimeout: ReturnType<typeof setTimeout> | undefined;

	constructor() {
		if (typeof window !== 'undefined') {
			this.setupWebSocket();
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
		this.syncSubscriptions();
	}

	private syncSubscriptions() {
		if (!this.ws) {
			this.setupWebSocket();
			return;
		}

		const jobsToSubscribe: string[] = [];
		for (const [id, job] of this.activeJobs) {
			if (job.status === 'pending' || job.status === 'processing') {
				jobsToSubscribe.push(id);
			}
		}

		if (jobsToSubscribe.length > 0) {
			this.ws.send({ logIds: jobsToSubscribe });
		}
	}

	private setupWebSocket() {
		if (this.ws) return;

		try {
			this.ws = api.v1.import['progress-ws'].subscribe();

			this.ws.on('open', () => {
				console.log('[JOB STORE] WebSocket connected');
				this.syncSubscriptions();
			});

			this.ws.on('message', (message: unknown) => {
				const data = message as Record<string, ProgressResult> | { error: string };
				if (!data || 'error' in data) return;

				for (const [id, result] of Object.entries(data)) {
					const job = this.activeJobs.get(id);
					if (job) {
						job.status = (result.status || 'pending') as ImportJob['status'];
						job.progress = {
							current: result.current || 0,
							total: result.total || 0,
							percentage: result.percentage || 0
						};
						job.message = result.message;

						if (result.status === 'success') {
							job.result = result.result;
							if (job.type === 'preview') {
								setTimeout(() => {
									this.activeJobs.delete(id);
								}, 30000);
							}
						} else if (result.status === 'failed') {
							job.error = result.errors ? result.errors.join('; ') : 'Unknown error';
						}

						this.activeJobs.set(id, { ...job });
					}
				}
			});

			this.ws.on('close', () => {
				console.log('[JOB STORE] WebSocket disconnected');
				this.ws = undefined;
				// Try reconnecting after a while if there are active jobs
				this.reconnectTimeout = setTimeout(() => {
					if (this.activeJobs.size > 0) {
						this.setupWebSocket();
					}
				}, 3000);
			});
		} catch (err) {
			console.error('WebSocket setup error:', err);
		}
	}

	destroy() {
		if (this.ws) {
			this.ws.close();
			this.ws = undefined;
		}
		if (this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout);
			this.reconnectTimeout = undefined;
		}
	}

	removeJob(jobId: string) {
		this.activeJobs.delete(jobId);
	}

	getJob(jobId: string) {
		return this.activeJobs.get(jobId);
	}
}

export const importProgress = new ImportProgressStore();
