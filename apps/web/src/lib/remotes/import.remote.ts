import { getRequestEvent, query } from '$app/server';
import { extractApiData } from '$lib/services/api-envelope';

export const getImportResults = query(
	'unchecked' as const,
	async (logId: string): Promise<Record<string, unknown> | null> => {
		const { locals } = getRequestEvent();
		if (!locals.user) return null;

		try {
			const { data, error } = await locals.api.v1.data.import({ id: logId }).progress.get();
			if (error) return null;

			const parsed = extractApiData<Record<string, unknown>>(data);
			return parsed.data ?? {};
		} catch {
			return null;
		}
	}
);

export const getImportExport = query(
	'unchecked' as const,
	async (logId: string): Promise<Record<string, unknown> | null> => {
		const { locals } = getRequestEvent();
		if (!locals.user) return null;

		try {
			const { data, error } = await locals.api.v1.data.import({ id: logId }).progress.get();
			if (error) return null;

			const parsed = extractApiData<Record<string, unknown>>(data);
			return parsed.data ?? {};
		} catch {
			return null;
		}
	}
);
