import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { BankAccount } from '@repo/types/shared/bank';
import type { DebtDetails } from '@repo/types/shared/debt';

const extractDebt = (payload: unknown): DebtDetails | null => {
	if (!payload || typeof payload !== 'object') return null;
	const p = payload as Record<string, unknown>;
	return (p.data as DebtDetails) ?? null;
};

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) {
		if (locals.apiOffline) {
			return {
				debt: null,
				error: 'Backend API is unavailable',
				isCreditor: false,
				isDebtor: false,
				isUploader: false,
				currentUser: null,
				creditorBanks: [] as BankAccount[],
				pendingProofs: [] as Array<unknown>
			};
		}

		throw redirect(302, '/login');
	}

	const { api } = locals;

	// Fetch single debt by ID
	const { data: debtData, error: debtError } = await api.v1.debts({ id: params.id }).get();

	const debt = extractDebt(debtData);

	if (debtError || !debt) {
		const finalMsg = (debtError?.value as { message?: string })?.message || 'Debt not found';
		return { debt: null, error: finalMsg };
	}

	// Check if user is related to this debt
	const isCreditor =
		debt.creditorId === locals.user.id || debt.creditorPhone === locals.user.phoneNumber;
	const isDebtor = debt.debtorId === locals.user.id || debt.debtorPhone === locals.user.phoneNumber;
	const isUploader = debt.uploadedById === locals.user.id;

	return {
		debt,
		isCreditor,
		isDebtor,
		isUploader,
		currentUser: locals.user,
		creditorBanks: [] as BankAccount[],
		pendingProofs: [] as Array<unknown>
	};
};
