import { form, getRequestEvent } from '$app/server';
import { invalid } from '@sveltejs/kit';
import { v, accountNumberSchema, accountNameSchema } from '@repo/validation/client';

export const addBank = form(
	v.object({
		bankCode: v.string(),
		bankName: v.string(),
		bankBin: v.string(),
		accountNumber: accountNumberSchema,
		accountName: accountNameSchema,
		isDefault: v.optional(v.picklist(['on']))
	}),
	async ({ bankCode, bankName, bankBin, accountNumber, accountName, isDefault }) => {
		const { locals } = getRequestEvent();
		if (!locals.user) {
			invalid('Unauthorized');
		}

		const payload = {
			bankCode,
			bankName,
			bankBin,
			accountNumber,
			accountName,
			isDefault: isDefault === 'on'
		};

		const { error } = await (locals.api.v1.banks as any).me.post(payload);

		if (error) {
			const errVal = error.value as Record<string, unknown>;
			invalid((errVal?.message as string) || (errVal?.details as string) || 'Failed to add account');
		}

		return { success: true };
	}
);

export const editBank = form(
	v.object({
		id: v.string(),
		bankCode: v.string(),
		bankName: v.string(),
		bankBin: v.string(),
		accountNumber: accountNumberSchema,
		accountName: accountNameSchema,
		isDefault: v.optional(v.picklist(['on']))
	}),
	async ({ id, bankCode, bankName, bankBin, accountNumber, accountName, isDefault }) => {
		const { locals } = getRequestEvent();
		if (!locals.user) invalid('Unauthorized');

		const payload = {
			bankCode,
			bankName,
			bankBin,
			accountNumber,
			accountName,
			isDefault: isDefault === 'on'
		};

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { error } = await (locals.api.v1.banks({ id }) as any).patch(payload);

		if (error) {
			const errVal = error.value as Record<string, unknown>;
			invalid((errVal?.message as string) || (errVal?.details as string) || 'Failed to update account');
		}

		return { success: true };
	}
);

export const deleteBank = form(
	v.object({
		id: v.string()
	}),
	async ({ id }) => {
		const { locals } = getRequestEvent();
		if (!locals.user) invalid('Unauthorized');

		const { error } = await locals.api.v1.banks({ id }).delete();

		if (error) {
			invalid('Failed to delete account');
		}

		return { success: true };
	}
);
