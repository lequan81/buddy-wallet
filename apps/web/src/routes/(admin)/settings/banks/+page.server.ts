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
