import { getRequestEvent, query } from '$app/server';
import type { Debt } from '@repo/types/core/debt';
import type { UserResponse } from '@repo/types/core/user';
import type { Pagination } from '@repo/types/api/pagination';
import { unwrapData, unwrapPagination } from '$lib/services/api-helpers';

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
			const debts = unwrapData<Debt[]>(data) ?? [];
			const pag = unwrapPagination(data, { page, limit: pageSize });

			return {
				debts,
				pagination: {
					total: pag.total,
					limit: pag.limit,
					page: pag.page,
					offset: (pag.page - 1) * pag.limit,
					hasMore: pag.page < pag.totalPages
				} satisfies Pagination
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
			const { data } = await locals.api.v1.user.admin.users.get({
					query: { page: 1, limit: 100 }
				});
			return unwrapData<UserResponse[]>(data) ?? [];
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
			locals.api.v1.debts.get({ query: { limit: 10, page: 1 } })
		]);

		const banks = unwrapData<unknown[]>(bankRes.data);
		hasBankAccount = Array.isArray(banks) && banks.length > 0;

		recentContacts = unwrapData<Debt[]>(contactsRes.data) ?? [];
	} catch (err) {
		console.error('[Dashboard] Failed to load bank/contacts:', err);
	}
	return { hasBankAccount, recentContacts };
});

export const getRecentDebts = query(async (): Promise<Debt[]> => {
	const { locals } = getRequestEvent();
	if (!locals.user) return [];

	try {
		const { data } = await locals.api.v1.debts.get({ query: { limit: 10, page: 1 } });
		return unwrapData<Debt[]>(data) ?? [];
	} catch {
		return [];
	}
});
