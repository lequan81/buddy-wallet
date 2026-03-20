import { getRequestEvent } from '$app/server';

export const getDashboardDebts = async (statusFilter: string, page: number, pageSize: number) => {
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
			return {
				debts: data?.debts || [],
				pagination: data?.pagination || { total: 0, limit: pageSize, offset: 0, hasMore: false }
			};
		})
		.catch(() => ({
			debts: [],
			pagination: { total: 0, limit: pageSize, offset: 0, hasMore: false }
		}));
};

export const getDashboardUsers = async (canManageUsers: boolean) => {
	const { locals } = getRequestEvent();
	if (!locals.user) return [];

	if (!canManageUsers) return [];
	return locals.api.v1.users
		.get()
		.then(({ data }) => data?.users || [])
		.catch(() => []);
};

export const getDashboardSecondaryData = async () => {
	const { locals } = getRequestEvent();
	if (!locals.user) return { hasBankAccount: false, recentContacts: [] };
	
	let hasBankAccount = false;
	let recentContacts: string[] = [];
	try {
		const [bankRes, contactsRes] = await Promise.all([
			locals.api.v1.banks.me.get(),
			locals.api.v1.debts['recent-contacts'].get()
		]);
		hasBankAccount = !!(bankRes.data?.success && bankRes.data.accounts && bankRes.data.accounts.length > 0);
		recentContacts = contactsRes.data?.contacts || [];
	} catch (err) {
		console.error('[Dashboard] Failed to load bank/contacts:', err);
	}
	return { hasBankAccount, recentContacts };
};

export const getRecentDebts = async () => {
	const { locals } = getRequestEvent();
	if (!locals.user) return [];

	return locals.api.v1.debts.recent
		.get()
		.then(({ data }) => data?.debts || [])
		.catch(() => []);
};
