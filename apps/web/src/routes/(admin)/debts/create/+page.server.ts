import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { Debt } from '@repo/types/core/debt';
import { extractApiData, extractApiErrorMessage } from '$lib/services/api-envelope';

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
			api.v1.debts.get({ query: { limit: '10', page: '1' } })
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

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const formData = await request.formData();
		const amount = Number(formData.get('amount'));
		const description = formData.get('description') as string;
		const counterpartyPhone = formData.get('counterpartyPhone') as string;
		const direction = formData.get('direction') as 'LEND' | 'BORROW';
		const expiryOption = (formData.get('expiryOption') as string) || 'never';
		const confirmDuplicate = formData.get('confirmDuplicate') === 'true';

		if (!locals.user) {
			if (locals.apiOffline) {
				return fail(503, { message: 'Backend API is unavailable' });
			}

			throw redirect(303, '/login');
		}

		// User must have a phone number to create debts
		// Note: locals.user might be stale if profile updated in same session without re-login logic,
		// but standard flow updates it. Let's rely on locals for now but ensure we check it.
		// Actually, locals.user comes from hooks.server.ts which validates session on every request.

		if (!locals.user.phoneNumber) {
			throw redirect(303, '/settings/profile?error=missing_phone');
		}

		if (!amount || !description || !counterpartyPhone || !direction) {
			return fail(400, { message: 'All fields are required' });
		}

		const { api } = locals;

		// Block LEND debt creation if no bank account
		if (direction === 'LEND') {
			try {
				const { data } = await api.v1.bank.accounts.get();
				const hasBankAccount = hasAccounts(extractApiData<unknown[]>(data).data);

				if (!hasBankAccount) {
					return fail(400, {
						message:
							'You must add a bank account before creating a debt where someone owes you. Add one in Settings → Banks.'
					});
				}
			} catch (err) {
				console.error('[Debt Create] Failed to check bank accounts:', err);
				return fail(500, { message: 'Failed to verify bank account status' });
			}
		}

		try {
			const { error, status } = await locals.api.v1.debts.post({
				amount,
				description,
				counterpartyPhone,
				direction,
				expiryOption: expiryOption as 'never' | '7d' | '30d' | '90d',
				confirmDuplicate
			});

			if (error) {
				const errorObj = error.value as (Record<string, unknown> & { duplicates?: unknown[]; code?: string }) | undefined;

				// Handle duplicate warning
				if (status === 409 && errorObj?.code === 'DUPLICATE_WARNING') {
					return fail(409, {
						message: 'Potential duplicate found',
						code: 'DUPLICATE_WARNING',
						duplicates: Array.isArray(errorObj?.duplicates) ? errorObj?.duplicates : []
					});
				}
				return fail(400, { message: extractApiErrorMessage(error.value, 'Failed to create debt') });
			}
		} catch (err) {
			console.error(err);
			return fail(500, { message: 'Server connection failed' });
		}

		throw redirect(303, '/dashboard');
	}
};
