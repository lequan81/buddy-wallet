import { describe, expect, test } from 'bun:test';
import { buildPaginationFromMeta, extractApiData, extractApiErrorMessage } from './api-envelope';

describe('api-envelope helpers', () => {
	test('extracts data and meta from success envelope', () => {
		const payload = {
			success: true,
			data: [{ id: '1' }],
			meta: { total: 1, page: 1, limit: 10 }
		};

		const parsed = extractApiData<{ id: string }[]>(payload);
		expect(parsed.data).toEqual([{ id: '1' }]);
		expect(parsed.meta).toEqual({ total: 1, page: 1, limit: 10 });
	});

	test('prefers nested error.message', () => {
		const message = extractApiErrorMessage(
			{ success: false, error: { message: 'Nested message' }, message: 'Outer message' },
			'Fallback'
		);
		expect(message).toBe('Nested message');
	});

	test('builds pagination from meta fields', () => {
		const pagination = buildPaginationFromMeta({ total: 42, page: 2, limit: 10 }, 1, 20);
		expect(pagination).toMatchObject({ total: 42, page: 2, limit: 10, offset: 10, hasMore: true });
	});
});
