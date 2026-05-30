import { describe, expect, test } from 'bun:test';
import { normalizeDebtIdList } from '../../lib/services/api-helpers';

describe('normalizeDebtIdList', () => {
	test('normalizes comma-separated string ids', () => {
		expect(normalizeDebtIdList('a, b , ,c')).toEqual(['a', 'b', 'c']);
	});

	test('keeps valid id arrays', () => {
		expect(normalizeDebtIdList(['x', '', 1, 'y'])).toEqual(['x', 'y']);
	});

	test('returns empty array for invalid payloads', () => {
		expect(normalizeDebtIdList(undefined)).toEqual([]);
		expect(normalizeDebtIdList({ ids: ['a'] })).toEqual([]);
	});
});
