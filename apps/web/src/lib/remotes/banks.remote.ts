import { form, getRequestEvent } from '$app/server';
import { invalid } from '@sveltejs/kit';
import { extractApiErrorMessage } from '$lib/services/api-envelope';

export const addBank = form(
	'unchecked' as const,
	async (data) => {
		const { locals } = getRequestEvent();
		if (!locals.user) {
			invalid('Unauthorized');
		}

		const payload = {
			bankCode: data.bankCode as string,
			bankName: data.bankName as string,
			bankBin: data.bankBin as string,
			accountNumber: data.accountNumber as string,
			accountName: data.accountName as string,
			isDefault: data.isDefault === 'on'
		};

		const { error } = await locals.api.v1.bank.accounts.post(payload);

		if (error) {
			invalid(extractApiErrorMessage(error, 'Failed to add account'));
		}

		return {};
	}
);

export const editBank = form(
	'unchecked' as const,
	async (data) => {
		const { locals } = getRequestEvent();
		if (!locals.user) invalid('Unauthorized');

		const id = data.id as string;
		const payload = {
			bankCode: data.bankCode as string,
			bankName: data.bankName as string,
			bankBin: data.bankBin as string,
			accountNumber: data.accountNumber as string,
			accountName: data.accountName as string,
			isDefault: data.isDefault === 'on'
		};

		const { error } = await locals.api.v1.bank.accounts({ id }).patch(payload);

		if (error) {
			invalid(extractApiErrorMessage(error, 'Failed to update account'));
		}

		return { success: true };
	}
);

export const deleteBank = form(
	'unchecked' as const,
	async (data) => {
		const { locals } = getRequestEvent();
		if (!locals.user) invalid('Unauthorized');

		const id = data.id as string;
		const { error } = await locals.api.v1.bank.accounts({ id }).delete();

		if (error) {
			invalid(extractApiErrorMessage(error, 'Failed to delete account'));
		}

		return { success: true };
	}
);
