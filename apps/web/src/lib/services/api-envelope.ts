import type { Pagination } from '@repo/types/api/pagination';

type UnknownRecord = Record<string, unknown>;

interface ApiEnvelopeData<T> {
	data: T;
	message?: string;
	meta?: UnknownRecord;
}

interface ApiEnvelopeError {
	error?: {
		code?: string;
		message?: string;
		detail?: string;
	};
	message?: string;
}

const isObject = (value: unknown): value is UnknownRecord =>
	typeof value === 'object' && value !== null;

/**
 * Extract data from the API response envelope.
 * Success responses have shape: { data: T, message?, meta? }
 * Error responses have shape: { error: { code, message } }
 */
export function extractApiData<T>(payload: unknown): {
	data: T | null;
	meta?: UnknownRecord;
	message?: string;
} {
	if (payload === null || payload === undefined) return { data: null };

	// Support both:
	// 1) direct API envelopes: { data, meta?, message? }
	// 2) Eden Treaty responses: { data: { data, meta?, message? }, error, status, response }
	// 3) already-unwrapped values: T
	let candidate: unknown = payload;
	if (
		isObject(candidate) &&
		'response' in candidate &&
		'status' in candidate &&
		'data' in candidate
	) {
		candidate = (candidate as { data: unknown }).data;
	}

	if (isObject(candidate) && 'error' in candidate && !('data' in candidate)) {
		return { data: null };
	}

	if (!isObject(candidate) || !('data' in candidate)) {
		return { data: candidate as T };
	}

	const envelope = candidate as unknown as ApiEnvelopeData<T>;
	return {
		data: envelope.data,
		meta: envelope.meta,
		message: envelope.message
	};
}

export function extractApiErrorMessage(value: unknown, fallback: string): string {
	if (!isObject(value)) return fallback;

	const envelope = value as unknown as ApiEnvelopeError;
	const nestedMessage = envelope.error?.message;
	if (typeof nestedMessage === 'string' && nestedMessage.length > 0) return nestedMessage;

	const detail = envelope.error?.detail;
	if (typeof detail === 'string' && detail.length > 0) return detail;

	if (typeof envelope.message === 'string' && envelope.message.length > 0) return envelope.message;

	return fallback;
}

export function buildPaginationFromMeta(
	meta: UnknownRecord | undefined,
	page: number,
	limit: number
): Pagination {
	const total = typeof meta?.total === 'number' ? meta.total : 0;
	const safeLimit = typeof meta?.limit === 'number' ? meta.limit : limit;
	const safePage = typeof meta?.page === 'number' ? meta.page : page;
	const offset = (safePage - 1) * safeLimit;

	return {
		total,
		page: safePage,
		limit: safeLimit,
		offset,
		hasMore: safePage * safeLimit < total
	};
}
