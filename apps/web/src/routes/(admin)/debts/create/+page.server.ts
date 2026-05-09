import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { Debt } from '@repo/types/core/debt';
import { extractApiData } from '$lib/services/api-envelope';

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
					description: url.searchParams.get('description') || '',
					amount: url.searchParams.get('amount') || '',
					phone: url.searchParams.get('phone') || ''
				},
				error: 'Backend API is unavailable'
			};
		}

		throw redirect(303, '/login');
	}

	// User must have a phone number to create debts
	if (!locals.user.phoneNumber) {
		throw redirect(303, '/settings/profile?error=missing_phone');
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
		hasBankAccount = hasAccounts(extractApiData<unknown[]>(bankRes.data).data);
		recentContacts = getRecentContacts(extractApiData<Debt[]>(contactsRes.data).data, locals.user.phoneNumber ?? null);
	} catch (err) {
		console.error('[Debt Create] Failed to load data:', err);
	}

	return {
		hasBankAccount,
		recentContacts,
		prefill: {
			description: url.searchParams.get('description') || '',
			amount: url.searchParams.get('amount') || '',
			phone: url.searchParams.get('phone') || ''
		}
	};
};

