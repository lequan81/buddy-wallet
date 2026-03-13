import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { accountNumberSchema, accountNameSchema, v } from '@repo/validation/client';

export const load: PageServerLoad = async ({
	locals
}) => {
	if (!locals.user) return fail(401);

	const { api } = locals;

	// Parallel fetch using Eden
	const [banksRes, myAccountsRes] = await Promise.all([
		api.v1.banks.list.get(),
		api.v1.banks.me.get()
	]);

	const banks = banksRes.data?.success ? banksRes.data.banks : [];
	const accounts = myAccountsRes.data?.success ? myAccountsRes.data.accounts : [];

	return {
		banks,
		accounts
	};
};

export const actions: Actions = {
	add: async ({
		request,
		locals
	}) => {
		if (!locals.user) return fail(401);

		const formData = await request.formData();
		const bankCode = formData.get('bankCode') as string;
		const bankName = formData.get('bankName') as string;
		const bankBin = formData.get('bankBin') as string;
		const accountNumber = formData.get('accountNumber') as string;
		const accountName = formData.get('accountName') as string;
		const isDefault = formData.get('isDefault') === 'on';

		const accountValidation = v.safeParse(accountNumberSchema, accountNumber);
		const nameValidation = v.safeParse(accountNameSchema, accountName);

		if (!accountValidation.success) {
			return fail(400, { message: accountValidation.issues[0].message });
		}
		if (!nameValidation.success) {
			return fail(400, { message: nameValidation.issues[0].message });
		}

		const { api } = locals;

		const payload = {
			bankCode,
			bankName,
			bankBin,
			accountNumber,
			accountName,
			isDefault
		};

		const { error, status } = await api.v1.banks.me.post(payload);

		if (error) {
			return fail(status, { message: error?.value?.message || 'Failed to add account' });
		}

		return { success: true };
	},

	edit: async ({
		request,
		locals
	}) => {
		if (!locals.user) return fail(401);

		const formData = await request.formData();
		const id = formData.get('id') as string;
		const bankCode = formData.get('bankCode') as string;
		const bankName = formData.get('bankName') as string;
		const bankBin = formData.get('bankBin') as string;
		const accountNumber = formData.get('accountNumber') as string;
		const accountName = formData.get('accountName') as string;
		const isDefault = formData.get('isDefault') === 'on';

		const accountValidation = v.safeParse(accountNumberSchema, accountNumber);
		const nameValidation = v.safeParse(accountNameSchema, accountName);

		if (!accountValidation.success) {
			return fail(400, { message: accountValidation.issues[0].message });
		}
		if (!nameValidation.success) {
			return fail(400, { message: nameValidation.issues[0].message });
		}

		const { api } = locals;

		const payload = {
			bankCode,
			bankName,
			bankBin,
			accountNumber,
			accountName,
			isDefault
		};

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const { error, status } = await (api.v1.banks({ id }) as any).patch(payload);

		if (error) {
			return fail(status, { message: error?.value?.message || 'Failed to update account' });
		}

		return { success: true };
	},

	delete: async ({
		request,
		locals
	}) => {
		if (!locals.user) return fail(401);

		const formData = await request.formData();
		const id = formData.get('id') as string;

		const { api } = locals;

		const { error, status } = await api.v1.banks({ id }).delete();

		if (error) {
			return fail(status, { message: 'Failed to delete account' });
		}

		return { success: true };
	}
};
