import { redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import type { Debt, BankAccount, ApiErrorValue } from '@repo/types';

const extractDebt = (payload: unknown): Debt | null => {
	if (!payload || typeof payload !== 'object') return null;
	const directDebt = (payload as { debt?: unknown }).debt;
	if (directDebt) return directDebt as Debt;
	const nested = (payload as { data?: unknown }).data;
	if (nested && typeof nested === 'object') {
		const nestedDebt = (nested as { debt?: unknown }).debt;
		return nestedDebt ? (nestedDebt as Debt) : null;
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
		return { debt: null, error: debtError?.value?.message || (debtError?.value as ApiErrorValue)?.error || 'Debt not found' };
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
		creditorBanks = bankData?.accounts || [];
	}

	// If I am the creditor, I want to see pending proofs.
	if (isCreditor) {
		const { data: proofsData } = await api.v1.proofs.debt({ debtId: debt.id }).get();
		pendingProofs = ((proofsData as Record<string, unknown>)?.data as Record<string, unknown>)?.proofs as typeof pendingProofs || [];
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

export const actions: Actions = {
	updateStatus: async ({ locals, params, request }) => {
		if (!locals.user) {
			return fail(401, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const status = formData.get('status') as string;

		if (!status) {
			return fail(400, { error: 'Status is required' });
		}

		const { api } = locals;
		const { error, status: statusCode } = await api.v1.debts({ id: params.id }).status.patch({ status: status as 'pending' | 'confirmed' | 'paid' | 'disputed' | 'cancelled' });

		if (error) {
			const errorMsg = error.value?.message || (error.value as ApiErrorValue)?.details || 'Failed to update status';
			return fail(statusCode, { error: errorMsg });
		}

		// Redirect to confirmation page for paid/confirmed status changes
		if (status === 'paid' || status === 'confirmed') {
			throw redirect(303, `/debts/${params.id}/confirmation?status=${status}`);
		}

		return { success: true, status };
	},

	update: async ({ locals, params, request }) => {
		if (!locals.user) {
			return fail(401, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const description = formData.get('description') as string;
		const amount = formData.get('amount') as string;

		const body: Record<string, unknown> = {};
		if (description) body.description = description;
		if (amount) body.amount = Number(amount);

		const { api } = locals;
		const { error, status: statusCode } = await api.v1.debts({ id: params.id }).put(body);

		if (error) {
			const errorMsg = error.value?.message || (error.value as ApiErrorValue)?.details || 'Failed to update debt';
			return fail(statusCode, { error: errorMsg });
		}

		return { success: true, message: 'Debt updated successfully' };
	},

	delete: async ({ locals, params }) => {
		if (!locals.user) {
			return fail(401, { error: 'Unauthorized' });
		}

		const { api } = locals;
		const { error, status: statusCode } = await api.v1.debts({ id: params.id }).delete();

		if (error) {
			const errorMsg = error.value?.message || (error.value as ApiErrorValue)?.details || 'Failed to delete debt';
			return fail(statusCode, { error: errorMsg });
		}

		throw redirect(303, '/dashboard?deleted=true');
	},

	confirmDebt: async ({ locals, params }) => {
		if (!locals.user) {
			return fail(401, { error: 'Unauthorized' });
		}

		const { api } = locals;
		const { error, status: statusCode } = await api.v1.debts({ id: params.id }).confirm.post();

		if (error) {
			const errorMsg = error.value?.message || (error.value as ApiErrorValue)?.details || 'Failed to confirm debt';
			return fail(statusCode, { error: errorMsg });
		}

		return { success: true, message: 'Debt confirmed successfully' };
	},

	approveProof: async ({ locals, request }) => {
		if (!locals.user) {
			return fail(401, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const proofId = formData.get('proofId') as string;

		if (!proofId) {
			return fail(400, { error: 'Proof ID is required' });
		}

		const { api } = locals;
		const { data, error, status: statusCode } = await api.v1.proofs({ proofId }).review.patch({ action: 'approved' });

		if (error) {
			const errorMsg = error.value?.message || (error.value as ApiErrorValue)?.details || 'Failed to approve proof';
			return fail(statusCode, { error: errorMsg });
		}

		const responseData = data as { allProofsApproved?: boolean; debtId?: string } | null;
		return {
			success: true,
			message: 'Proof approved successfully',
			allProofsApproved: responseData?.allProofsApproved || false,
			debtId: responseData?.debtId || null
		};
	},

	rejectProof: async ({ locals, request }) => {
		if (!locals.user) {
			return fail(401, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const proofId = formData.get('proofId') as string;
		const reason = formData.get('reason') as string;

		if (!proofId) {
			return fail(400, { error: 'Proof ID is required' });
		}

		const { api } = locals;
		const { error, status: statusCode } = await api.v1.proofs({ proofId }).review.patch({ action: 'rejected', reason: reason || undefined });

		if (error) {
			const errorMsg = error.value?.message || (error.value as ApiErrorValue)?.details || 'Failed to reject proof';
			return fail(statusCode, { error: errorMsg });
		}

		return { success: true, message: 'Proof rejected successfully' };
	},

	suggestEdit: async ({ locals, params, request }) => {
		if (!locals.user) {
			return fail(401, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const amount = formData.get('amount') as string;
		const description = formData.get('description') as string;

		if (!amount && !description) {
			return fail(400, { error: 'Please provide at least amount or description' });
		}

		const { api } = locals;
		const { error, status: statusCode } = await api.v1.debts({ id: params.id }).suggest.post({
			amount: amount ? Number(amount) : undefined,
			description: description || undefined
		});

		if (error) {
			const errorMsg = error.value?.message || (error.value as ApiErrorValue)?.details || 'Failed to submit suggestion';
			return fail(statusCode, { error: errorMsg });
		}

		return { success: true, message: 'Edit suggestion sent' };
	},

	respondSuggestion: async ({ locals, params, request }) => {
		if (!locals.user) {
			return fail(401, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const accept = formData.get('accept') === 'true';

		const { api } = locals;
		const { error, status: statusCode } = await api.v1.debts({ id: params.id }).suggestion.respond.post({ accept });

		if (error) {
			const errorMsg = error.value?.message || (error.value as ApiErrorValue)?.details || 'Failed to respond to suggestion';
			return fail(statusCode, { error: errorMsg });
		}

		return { success: true, message: accept ? 'Suggestion accepted' : 'Suggestion rejected' };
	}
};
