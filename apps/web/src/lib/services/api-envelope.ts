import type { Pagination } from '@repo/types/api/pagination';

type UnknownRecord = Record<string, unknown>;

interface ApiEnvelopeSuccess<T> {
	success: true;
	data: T;
	message?: string;
	meta?: UnknownRecord;
}

interface ApiEnvelopeError {
	success: false;
	error?: {
		code?: string;
		message?: string;
		detail?: string;
	};
	message?: string;
}

const isObject = (value: unknown): value is UnknownRecord =>
	typeof value === 'object' && value !== null;

export function extractApiData<T>(payload: unknown): {
	data: T | null;
	meta?: UnknownRecord;
	message?: string;
} {
	if (!isObject(payload) || payload.success !== true || !('data' in payload)) {
		return { data: null };
	}

	const envelope = payload as ApiEnvelopeSuccess<T>;
	return {
		data: envelope.data,
		meta: envelope.meta,
		message: envelope.message
	};
}

export function extractApiErrorMessage(value: unknown, fallback: string): string {
	if (!isObject(value)) return fallback;

	const envelope = value as ApiEnvelopeError;
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
