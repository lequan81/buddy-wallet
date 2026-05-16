import { getRequestEvent, query } from '$app/server';
import { unwrapData } from '$lib/services/api-helpers';

export const getImportResults = query(
	'unchecked' as const,
	async (logId: string): Promise<Record<string, unknown> | null> => {
		const { locals } = getRequestEvent();
		if (!locals.user) return null;

		try {
			const { data, error } = await locals.api.v1.data.import({ id: logId }).progress.get();
			if (error) return null;

			return unwrapData<Record<string, unknown>>(data);
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

			return unwrapData<Record<string, unknown>>(data);
		} catch {
			return null;
		}
	}
);
