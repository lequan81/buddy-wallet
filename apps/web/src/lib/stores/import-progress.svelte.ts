import { SvelteMap } from 'svelte/reactivity';

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
	result?: any;
	error?: string;
	pollInterval?: Timer;
}

class ImportProgressStore {
	// Use Svelte 5 Map for reactivity
	activeJobs = new SvelteMap<string, ImportJob>();

	addJob(jobId: string, type: 'preview' | 'import', fileName: string) {
		this.activeJobs.set(jobId, {
			jobId,
			type,
			fileName,
			status: 'pending',
			progress: { current: 0, total: 0, percentage: 0 }
		});
		this.startPolling(jobId);
	}

	private startPolling(jobId: string) {
		// Poll every 1s
		const interval = setInterval(async () => {
			try {
				const res = await fetch(`/api/import/progress/${jobId}`);
				if (!res.ok) {
					if (res.status === 404) return; // Job might not be ready in Redis yet
					return;
				}

				const data = await res.json();
				if (!data.success) return;

				const job = this.activeJobs.get(jobId);
				if (!job) {
					clearInterval(interval);
					return;
				}

				// Update job state
				job.status = data.status;
				job.progress = {
					current: data.current || 0,
					total: data.total || 0,
					percentage: data.percentage || 0
				};

				if (data.status === 'success') {
					job.result = data; // Store result/preview data
					this.stopPolling(jobId);
				} else if (data.status === 'failed') {
					job.error = data.errors ? JSON.stringify(data.errors) : 'Unknown error';
					this.stopPolling(jobId);
				}

				// Trigger reactivity update (Map.set might differ in behavior depending on exact svelte version,
				// but modifying the object inside the reactive map usually works in Runes if the object properties are also proxied
				// or if we re-set. Re-setting is safest.)
				this.activeJobs.set(jobId, job);
			} catch (err) {
				console.error('Polling error:', err);
			}
		}, 1000);

		const job = this.activeJobs.get(jobId);
		if (job) {
			job.pollInterval = interval;
			this.activeJobs.set(jobId, job);
		}
	}

	stopPolling(jobId: string) {
		const job = this.activeJobs.get(jobId);
		if (job?.pollInterval) {
			clearInterval(job.pollInterval);
			job.pollInterval = undefined;
			this.activeJobs.set(jobId, job);
		}
	}

	removeJob(jobId: string) {
		this.stopPolling(jobId);
		this.activeJobs.delete(jobId);
	}

	getJob(jobId: string) {
		return this.activeJobs.get(jobId);
	}
}

export const importProgress = new ImportProgressStore();
