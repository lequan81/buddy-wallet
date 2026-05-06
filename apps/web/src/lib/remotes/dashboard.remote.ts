import { getRequestEvent, query } from '$app/server';
import type { Debt } from '@repo/types/core/debt';
import type { UserResponse } from '@repo/types/core/user';
import type { Pagination } from '@repo/types/api/pagination';
import { extractApiData, buildPaginationFromMeta } from '$lib/services/api-envelope';

interface DashboardDebtsInput {
	statusFilter: string;
	page: number;
	pageSize: number;
}

interface DebtListResult {
	debts: Debt[];
	pagination: Pagination;
}

const emptyPagination = (pageSize: number): Pagination => ({
	total: 0,
	limit: pageSize,
	page: 1,
	offset: 0,
	hasMore: false
});

const emptyDebtsResult = (pageSize: number): DebtListResult => ({
	debts: [],
	pagination: emptyPagination(pageSize)
});

export const getDashboardDebts = query(
	'unchecked' as const,
	async ({ statusFilter, page, pageSize }: DashboardDebtsInput): Promise<DebtListResult> => {
		const { locals } = getRequestEvent();
		if (!locals.user) return emptyDebtsResult(pageSize);

		const debtsQuery: Record<string, string> = {
			limit: String(pageSize),
			page: String(page)
		};
		if (statusFilter !== 'all') {
			debtsQuery.status = statusFilter;
		}

		try {
			const { data } = await locals.api.v1.debts.get({ query: debtsQuery });
			const parsed = extractApiData<Debt[]>(data);
			if (!parsed.data) {
				return emptyDebtsResult(pageSize);
			}

			return {
				debts: parsed.data,
				pagination: buildPaginationFromMeta(parsed.meta, page, pageSize)
			};
		} catch {
			return emptyDebtsResult(pageSize);
		}
	}
);

export const getDashboardUsers = query(
	'unchecked' as const,
	async (canManageUsers: boolean): Promise<UserResponse[]> => {
		const { locals } = getRequestEvent();
		if (!locals.user || !canManageUsers) return [];

		try {
			const { data } = await locals.api.v1.user['admin/users'].get({
				query: { page: '1', limit: '100' }
			});
			const parsed = extractApiData<UserResponse[]>(data);
			return parsed.data ?? [];
		} catch {
			return [];
		}
	}
);

export const getDashboardSecondaryData = query(async () => {
	const { locals } = getRequestEvent();
	if (!locals.user) return { hasBankAccount: false, recentContacts: [] as Debt[] };

	let hasBankAccount = false;
	let recentContacts: Debt[] = [];
	try {
		const [bankRes, contactsRes] = await Promise.all([
			locals.api.v1.bank.accounts.get(),
			locals.api.v1.debts.get({ query: { limit: '10', page: '1' } })
		]);

		const bankParsed = extractApiData<unknown[]>(bankRes.data);
		hasBankAccount = Array.isArray(bankParsed.data) && bankParsed.data.length > 0;

		const contactsParsed = extractApiData<Debt[]>(contactsRes.data);
		recentContacts = contactsParsed.data ?? [];
	} catch (err) {
		console.error('[Dashboard] Failed to load bank/contacts:', err);
	}
	return { hasBankAccount, recentContacts };
});

export const getRecentDebts = query(async (): Promise<Debt[]> => {
	const { locals } = getRequestEvent();
	if (!locals.user) return [];

	try {
		const { data } = await locals.api.v1.debts.get({ query: { limit: '10', page: '1' } });
		const parsed = extractApiData<Debt[]>(data);
		return parsed.data ?? [];
	} catch {
		return [];
	}
});
