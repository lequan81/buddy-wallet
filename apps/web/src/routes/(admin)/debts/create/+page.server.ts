import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { ApiErrorValue } from '@repo/types/api/base';

type RecentContactsResponse = { success: true; items: string[] };

const getRecentContacts = (data: unknown): string[] => {
	if (!data || typeof data !== 'object') return [];
	const items = (data as { items?: unknown }).items;
	return Array.isArray(items) ? items : [];
};

const hasAccounts = (payload: unknown): boolean => {
	if (!payload || typeof payload !== 'object') return false;
	const items = (payload as { items?: unknown }).items;
	return Array.isArray(items) && items.length > 0;
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
			api.v1.banks.me.get(),
			api.v1.debts['recent-contacts'].get()
		]);
		hasBankAccount = hasAccounts(bankRes.data);
		recentContacts = getRecentContacts(contactsRes.data as RecentContactsResponse | null);
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
				const { data } = await api.v1.banks.me.get();
				const hasBankAccount = hasAccounts(data);

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
			const { data, error, status } = await api.v1.debts.post({
				amount,
				description,
				counterpartyPhone,
				direction,
				expiryOption: expiryOption as 'never' | '7d' | '30d' | '90d',
				confirmDuplicate
			});

			if (error) {
				const errorObj = error.value as (Record<string, unknown> & { duplicates?: unknown[] }) | undefined;

				// Handle duplicate warning
				if (status === 409 && errorObj?.code === 'DUPLICATE_WARNING') {
					return fail(409, {
						message: 'Potential duplicate found',
						code: 'DUPLICATE_WARNING',
						duplicates: Array.isArray(errorObj?.duplicates) ? errorObj?.duplicates : []
					});
				}

				const nestedError =
					typeof errorObj?.error === 'string' ? errorObj?.error : (errorObj?.error as Record<string, unknown>)?.message;
				const errMsg =
					(errorObj?.details as string) ||
					(errorObj?.message as string) ||
					(nestedError as string) ||
					'Failed to create debt';
				return fail(400, { message: errMsg });
			}
		} catch (err) {
			console.error(err);
			return fail(500, { message: 'Server connection failed' });
		}

		throw redirect(303, '/dashboard');
	}
};
