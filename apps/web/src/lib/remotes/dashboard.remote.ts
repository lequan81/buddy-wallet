import { getRequestEvent, query } from '$app/server';
import * as v from 'valibot';
import type { PaginatedResult } from '@repo/types';

export const getDashboardDebts = query(v.object({ statusFilter: v.string(), page: v.number(), pageSize: v.number() }), async ({statusFilter, page, pageSize}) => {
	const { locals } = getRequestEvent();
	if (!locals.user) return { debts: [], pagination: { total: 0, limit: pageSize, offset: 0, hasMore: false } };

	const offset = (page - 1) * pageSize;
	const debtsQuery: Record<string, string> = {
		limit: pageSize.toString(),
		offset: offset.toString()
	};
	if (statusFilter !== 'all') {
		debtsQuery.status = statusFilter;
	}

	return locals.api.v1.debts
		.get({ query: debtsQuery })
		.then(({ data }) => {
			const result = data as unknown as PaginatedResult<unknown>;
			return {
				debts: result?.data || [],
				pagination: result?.pagination ? {
					...result.pagination,
					offset,
					hasMore: (result.pagination.total > offset + pageSize)
				} : { total: 0, limit: pageSize, offset: 0, hasMore: false }
			};
		})
		.catch(() => ({
			debts: [],
			pagination: { total: 0, limit: pageSize, offset: 0, hasMore: false }
		}));
});

export const getDashboardUsers = query(v.boolean(), async (canManageUsers) => {
	const { locals } = getRequestEvent();
	if (!locals.user) return [];

	if (!canManageUsers) return [];
	return locals.api.v1.users
		.get()
		.then(({ data }) => (data as unknown as PaginatedResult<unknown>)?.data || [])
		.catch(() => []);
});

export const getDashboardSecondaryData = query(async () => {
	const { locals } = getRequestEvent();
	if (!locals.user) return { hasBankAccount: false, recentContacts: [] };
	
	let hasBankAccount = false;
	let recentContacts: string[] = [];
	try {
		const [bankRes, contactsRes] = await Promise.all([
			locals.api.v1.banks.me.get(),
			locals.api.v1.debts['recent-contacts'].get()
		]);
		const bankData = bankRes.data as unknown as { accounts?: unknown[] } | null;
		hasBankAccount = Array.isArray(bankData?.accounts) && bankData.accounts.length > 0;
		recentContacts = (contactsRes.data as unknown as { contacts: string[] })?.contacts || [];
	} catch (err) {
		console.error('[Dashboard] Failed to load bank/contacts:', err);
	}
	return { hasBankAccount, recentContacts };
});

export const getRecentDebts = query(async () => {
	const { locals } = getRequestEvent();
	if (!locals.user) return [];

	return locals.api.v1.debts.recent
		.get()
		.then((res) => (res.data as unknown as { data: unknown[] })?.data || [])
		.catch(() => []);
});
