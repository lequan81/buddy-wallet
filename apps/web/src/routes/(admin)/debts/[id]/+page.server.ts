import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { DebtDetails, BankAccount, ApiErrorValue } from '@repo/types';

const extractDebt = (payload: unknown): DebtDetails | null => {
	if (!payload || typeof payload !== 'object') return null;
	const directDebt = (payload as { debt?: unknown }).debt;
	if (directDebt) return directDebt as DebtDetails;
	const nested = (payload as { data?: unknown }).data;
	if (nested && typeof nested === 'object') {
		const nestedDebt = (nested as { debt?: unknown }).debt;
		return nestedDebt ? (nestedDebt as DebtDetails) : null;
	}
	return null;
};

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const { api } = locals;

	// Fetch single debt by ID
	const { data: debtData, error: debtError } = await api.v1.debts({ id: params.id }).get();

	const debt = extractDebt(debtData);

	if (debtError || !debt) {
		const errVal = debtError?.value as ApiErrorValue | undefined;
		const errMsg = errVal?.message || errVal?.error;
		const finalMsg = typeof errMsg === 'string' ? errMsg : (errMsg as { message?: string })?.message || 'Debt not found';
		return { debt: null, error: finalMsg };
	}

	// Check if user is related to this debt
	const isCreditor =
		debt.creditorId === locals.user.id || debt.creditorPhone === locals.user.phoneNumber;
	const isDebtor = debt.debtorId === locals.user.id || debt.debtorPhone === locals.user.phoneNumber;
	const isUploader = debt.uploadedById === locals.user.id;

	// Fetch additional data based on role
	let creditorBanks: BankAccount[] = [];
	let pendingProofs: Array<{ id: string; url: string; createdAt: string; status: string }> = [];

	// If I am the debtor, I need creditor's bank info to pay
	if (isDebtor && debt.creditorId) {
		const { data: bankData } = await api.v1.banks.user({ userId: debt.creditorId }).get();
		creditorBanks = (bankData?.accounts as unknown as BankAccount[]) || [];
	}

	// If I am the creditor, I want to see pending proofs.
	if (isCreditor) {
		const { data: proofsData } = await api.v1.upload['pending-proofs']({ debtId: debt.id }).get();
		pendingProofs = (proofsData as any)?.data || [];
	}

	return {
		debt,
		isCreditor,
		isDebtor,
		isUploader,
		currentUser: locals.user,
		creditorBanks,
		pendingProofs
	};
};
