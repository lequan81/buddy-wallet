import { redirect, getParam } from '$lib/services/navigation';
import type { PageServerLoad } from './$types';
import type { Debt } from '@repo/types/shared/debt';
import { unwrapData } from '$lib/services/api-helpers';

const hasAccounts = (accounts: unknown[] | null): boolean => Array.isArray(accounts) && accounts.length > 0;

const getRecentContacts = (debts: Debt[] | null, currentPhone: string | null): string[] => {
	if (!Array.isArray(debts)) return [];
	const contacts = debts
		.flatMap((debt) => [debt.creditorPhone, debt.debtorPhone])
		.filter((phone): phone is string => typeof phone === 'string' && phone.length > 0 && phone !== currentPhone);

	return Array.from(new Set(contacts)).slice(0, 10);
};

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		if (locals.apiOffline) {
			return {
				hasBankAccount: false,
				recentContacts: [],
				prefill: {
					description: getParam(url, 'description', ''),
					amount: getParam(url, 'amount', ''),
					phone: getParam(url, 'phone', '')
				},
				error: 'Backend API is unavailable'
			};
		}

		redirect(303, '/login');
	}

	// User must have a phone number to create debts
	if (!locals.user.phoneNumber) {
		redirect(303, '/settings/profile', { error: 'missing_phone' });
	}

	// Check if user has any bank accounts (required for LEND debts)
	let hasBankAccount = false;
	let recentContacts: string[] = [];

	try {
		const { api } = locals;
		const [bankRes, contactsRes] = await Promise.all([
			api.v1.bank.accounts.get(),
			api.v1.debts.get({ query: { limit: 10, page: 1 } })
		]);
		hasBankAccount = hasAccounts(unwrapData<unknown[]>(bankRes.data));
		recentContacts = getRecentContacts(unwrapData<Debt[]>(contactsRes.data), locals.user.phoneNumber ?? null);
	} catch (err) {
		console.error('[Debt Create] Failed to load data:', err);
	}

	return {
		hasBankAccount,
		recentContacts,
		prefill: {
			description: getParam(url, 'description', ''),
			amount: getParam(url, 'amount', ''),
			phone: getParam(url, 'phone', '')
		}
	};
};


