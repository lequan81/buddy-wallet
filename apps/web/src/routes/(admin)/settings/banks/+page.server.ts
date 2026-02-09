import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { API_URL, getAuthHeaders, safeJsonParse } from '$lib/api';
import type { BankResponse, AccountsResponse } from '@repo/interfaces';

export const load: PageServerLoad = async ({
	fetch,
	locals
}: {
	fetch: typeof window.fetch;
	locals: App.Locals;
}) => {
	if (!locals.user) return fail(401);

	const headers = getAuthHeaders(locals.accessToken);

	// Parallel fetch
	const [banksRes, myAccountsRes] = await Promise.all([
		fetch(`${API_URL}/v1/banks/list`, { headers }),
		fetch(`${API_URL}/v1/banks/me`, { headers })
	]);

	// Safe JSON parsing to handle server errors gracefully
	const banksData = await safeJsonParse<BankResponse>(banksRes);
	const accountsData = await safeJsonParse<AccountsResponse>(myAccountsRes);

	const banks = banksData?.banks || [];
	const accounts = accountsData?.accounts || [];

	return {
		banks,
		accounts
	};
};

export const actions: Actions = {
	add: async ({
		request,
		fetch,
		locals
	}: {
		request: Request;
		fetch: typeof window.fetch;
		locals: App.Locals;
	}) => {
		if (!locals.user) return fail(401);

		const formData = await request.formData();
		const bankCode = formData.get('bankCode');
		const bankName = formData.get('bankName');
		const bankBin = formData.get('bankBin');
		const accountNumber = formData.get('accountNumber');
		const accountName = formData.get('accountName');
		const isDefault = formData.get('isDefault') === 'on';

		const headers = getAuthHeaders(locals.accessToken);

		const payload = {
			bankCode,
			bankName,
			bankBin,
			accountNumber,
			accountName,
			isDefault
		};

		const res = await fetch(`${API_URL}/v1/banks/me`, {
			method: 'POST',
			body: JSON.stringify(payload),
			headers
		});

		const data = await safeJsonParse<{ message?: string }>(res);

		if (!res.ok) {
			return fail(res.status, { message: data?.message || 'Failed to add account' });
		}

		return { success: true };
	},

	delete: async ({
		request,
		fetch,
		locals
	}: {
		request: Request;
		fetch: typeof window.fetch;
		locals: App.Locals;
	}) => {
		if (!locals.user) return fail(401);

		const formData = await request.formData();
		const id = formData.get('id');

		const headers = getAuthHeaders(locals.accessToken);

		const res = await fetch(`${API_URL}/v1/banks/${id}`, {
			method: 'DELETE',
			headers
		});

		if (!res.ok) {
			return fail(res.status, { message: 'Failed to delete account' });
		}

		return { success: true };
	}
};
