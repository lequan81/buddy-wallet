import { fail } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { BankAccount, VietQRBank } from '@repo/types/core/bank';
import { fetchBanks } from '$lib/services/vietqr';
import { extractApiData } from '$lib/services/api-envelope';

export const load: PageServerLoad = async ({
	locals
}) => {
	if (!locals.user) return fail(401);

	const { data: accountEnvelope } = await locals.api.v1.bank.accounts.get();
	const accounts = extractApiData<BankAccount[]>(accountEnvelope).data ?? [];
	const banks = await fetchBanks();
	const mappedBanks: VietQRBank[] = banks.map((bank) => ({
		id: bank.id,
		code: bank.code,
		bin: bank.bin,
		name: bank.name,
		shortName: bank.shortName,
		logo: bank.logo,
		swift_code: bank.swift_code,
		transferSupported: bank.transferSupported,
		lookupSupported: bank.lookupSupported
	}));

	return {
		banks: mappedBanks,
		accounts
	};
};
