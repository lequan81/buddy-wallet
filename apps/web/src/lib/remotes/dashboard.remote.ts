import { getRequestEvent, query } from '$app/server';
import * as v from 'valibot';

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

		return (locals.api.v1.debts as any).index
		.get({ query: debtsQuery })
		.then(({ data }: { data: any }) => {
			return {
				debts: (data?.items || []) as any[],
				pagination: data?.pagination ? {
					...data.pagination,
					offset,
					hasMore: (data.pagination.total > offset + pageSize)
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
	return (locals.api.v1.users as any).index
		.get()
		.then(({ data }: { data: any }) => (data?.items || []) as any[])
		.catch(() => []);
});

export const getDashboardSecondaryData = query(async () => {
	const { locals } = getRequestEvent();
	if (!locals.user) return { hasBankAccount: false, recentContacts: [] };
	
	let hasBankAccount = false;
	let recentContacts: string[] = [];
	try {
		const [bankRes, contactsRes] = await Promise.all([
				(locals.api.v1.banks as any).index.get(),
				(locals.api.v1.debts as any).index.get({ query: { limit: '10' } })
		]);
		hasBankAccount = Array.isArray(bankRes.data?.items) && bankRes.data.items.length > 0;
		recentContacts = contactsRes.data?.items || [];
	} catch (err) {
		console.error('[Dashboard] Failed to load bank/contacts:', err);
	}
	return { hasBankAccount, recentContacts };
});

export const getRecentDebts = query(async () => {
	const { locals } = getRequestEvent();
	if (!locals.user) return [];

	return (locals.api.v1.debts as any).recent
		.get()
		.then((res: any) => (res.data?.items || res.items || []) as any[])
		.catch(() => []);
});
