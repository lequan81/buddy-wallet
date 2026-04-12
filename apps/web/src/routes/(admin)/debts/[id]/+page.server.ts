import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { DebtDetails } from '@repo/types/core/debt';
import type { BankAccount } from '@repo/types/core/bank';

const extractDebt = (payload: unknown): DebtDetails | null => {
	if (!payload || typeof payload !== 'object') return null;
	const item = (payload as { item?: unknown }).item;
	if (item) return item as DebtDetails;
	return null;
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
				creditorBanks: [],
				pendingProofs: []
			};
		}

		throw redirect(302, '/login');
	}

	const { api } = locals;

	// Fetch single debt by ID
	const { data: debtData, error: debtError } = await api.v1.debts({ id: params.id }).get();

	const debt = extractDebt(debtData);

	if (debtError || !debt) {
		const errVal = debtError?.value as Record<string, unknown> | undefined;
		const errMsg = (errVal?.message || errVal?.error) as string | undefined;
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
		creditorBanks = (bankData?.items as unknown as BankAccount[]) || [];
	}

	// If I am the creditor, I want to see pending proofs.
	if (isCreditor) {
		const { data: proofsData } = await api.v1.upload['pending-proofs']({ debtId: debt.id }).get();
		pendingProofs = ((proofsData as { files?: typeof pendingProofs } | null)?.files || []);
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
