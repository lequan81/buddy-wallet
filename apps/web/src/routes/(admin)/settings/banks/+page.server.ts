import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import type { BankAccount, BankInfo } from '@repo/types/core/bank';
import { accountNumberSchema, accountNameSchema, v } from '@repo/validation/client';

export const load: PageServerLoad = async ({
	locals
}) => {
	if (!locals.user) return fail(401);

	const { api } = locals;

	// Parallel fetch using Eden
	const [banksRes, myAccountsRes] = await Promise.all([
			(locals.api.v1.banks as any).list.get(),
			(locals.api.v1.banks as any).index.get()
	]);

	const banks = (banksRes.data as { items?: BankInfo[] } | null)?.items || [];
	const accounts = (myAccountsRes.data as { items?: BankAccount[] } | null)?.items || [];

	return {
		banks,
		accounts
	};
};
