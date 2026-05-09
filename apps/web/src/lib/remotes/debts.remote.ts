import { form, getRequestEvent } from '$app/server';
import { invalid, error } from '@sveltejs/kit';
import { extractApiData, extractApiErrorMessage } from '$lib/services/api-envelope';
import { normalizeDebtIdList } from '$lib/services/debt-batch';

type ApiErrorResult = {
	value?: unknown;
	status?: number;
};

type DebtDeletePayload = {
	deleted?: string[];
	notFound?: string[];
};

const ensureAuthenticated = () => {
	const { locals } = getRequestEvent();
	if (!locals.user) {
		error(401, { code: 'UNAUTHORIZED', message: 'Unauthorized' });
	}
	return locals;
};

const parseApiFailure = (apiError: ApiErrorResult | null | undefined, fallbackMessage: string): never => {
	invalid(extractApiErrorMessage(apiError?.value, fallbackMessage));
};

export const batchDeleteDebts = form('unchecked' as const, async (data) => {
	const locals = ensureAuthenticated();

	const ids = normalizeDebtIdList(data.ids);
	if (ids.length === 0) {
		invalid('No debts selected');
	}

	const { error: apiError, data: responseData } = await locals.api.v1.debts.batch.delete({ ids });
	if (apiError) {
		parseApiFailure(apiError, 'Failed to delete debts');
	}

	const parsed = extractApiData<DebtDeletePayload>(responseData);
	const deletedCount = parsed.data?.deleted?.length ?? ids.length;
	return { success: true, deleted: deletedCount };
});

export const deleteDebt = form('unchecked' as const, async (data) => {
	const locals = ensureAuthenticated();

	const id = typeof data.id === 'string' ? data.id : '';
	if (!id) error(400, { code: 'BAD_REQUEST', message: 'Debt ID is required' });

	const { error: apiError } = await locals.api.v1.debts({ id }).delete();
	if (apiError) {
		parseApiFailure(apiError, 'Failed to delete debt');
	}

	return { success: true, deleted: 1 };
});

export const deleteAllDebts = form(async () => {
	const locals = ensureAuthenticated();

	const { data: responseData, error: apiError } = await locals.api.v1.debts.all.delete({}, { query: { confirm: 'true' } });
	if (apiError) {
		parseApiFailure(apiError, 'Failed to delete all debts');
	}

	const parsed = extractApiData<{ deleted?: number }>(responseData);
	return { success: true, deleted: parsed.data?.deleted ?? 0 };
});

export const updateDebtStatus = form('unchecked' as const, async (data) => {
	const locals = ensureAuthenticated();
	const { params } = getRequestEvent();

	const status = typeof data.status === 'string' ? data.status : '';
	const debtId = params.id;
	if (!debtId) error(400, { code: 'BAD_REQUEST', message: 'Debt ID not found in URL' });

	let apiError: ApiErrorResult | null | undefined;
	if (status === 'confirmed') {
		({ error: apiError } = await locals.api.v1.debts({ id: debtId }).confirm.post({}));
	} else if (status === 'cancelled') {
		({ error: apiError } = await locals.api.v1.debts({ id: debtId }).cancel.post({}));
	} else if (status === 'paid') {
		({ error: apiError } = await locals.api.v1.debts({ id: debtId }).complete.post({}));
	} else {
		invalid('Invalid status transition');
		return { success: false, status };
	}

	if (apiError) {
		parseApiFailure(apiError, 'Failed to update status');
	}

	return { success: true, status };
});

export const updateDebt = form('unchecked' as const, async (data) => {
	const locals = ensureAuthenticated();
	const { params } = getRequestEvent();

	const description = typeof data.description === 'string' ? data.description : undefined;
	const amount = typeof data.amount === 'string' ? data.amount : undefined;
	const debtId = params.id;
	if (!debtId) error(400, { code: 'BAD_REQUEST', message: 'Debt ID not found in URL' });

	const body: Record<string, unknown> = {};
	if (description) body.description = description;
	if (amount) body.amount = Number(amount);

	const { error: apiError } = await locals.api.v1.debts({ id: debtId }).patch(body);
	if (apiError) {
		parseApiFailure(apiError, 'Failed to update debt');
	}

	return { success: true, message: 'Debt updated successfully' };
});

export const confirmDebt = form(async () => {
	const locals = ensureAuthenticated();
	const { params } = getRequestEvent();

	const debtId = params.id;
	if (!debtId) error(400, { code: 'BAD_REQUEST', message: 'Debt ID not found in URL' });

	const { error: apiError } = await locals.api.v1.debts({ id: debtId }).confirm.post({});
	if (apiError) {
		parseApiFailure(apiError, 'Failed to confirm debt');
	}

	return { success: true, message: 'Debt confirmed' };
});

export const approveProof = form('unchecked' as const, async (data) => {
	const locals = ensureAuthenticated();

	const proofId = typeof data.proofId === 'string' ? data.proofId : '';
	const { data: responseData, error: apiError } = await locals.api.v1.storage.proof({ id: proofId }).approve.post();
	if (apiError) {
		parseApiFailure(apiError, 'Failed to approve proof');
	}

	const parsed = extractApiData<unknown>(responseData);
	return { success: true, approved: true, data: parsed.data };
});

export const rejectProof = form('unchecked' as const, async (data) => {
	const locals = ensureAuthenticated();

	const proofId = typeof data.proofId === 'string' ? data.proofId : '';
	const reason = typeof data.reason === 'string' ? data.reason : undefined;
	const { error: apiError } = await locals.api.v1.storage.proof({ id: proofId }).reject.post({ reason });
	if (apiError) {
		parseApiFailure(apiError, 'Failed to reject proof');
	}

	return { success: true, rejected: true };
});

export const suggestEdit = form('unchecked' as const, async (data) => {
	const locals = ensureAuthenticated();
	const { params } = getRequestEvent();

	const amount = typeof data.amount === 'string' ? data.amount : undefined;
	const description = typeof data.description === 'string' ? data.description : undefined;
	const debtId = params.id;
	if (!debtId) error(400, { code: 'BAD_REQUEST', message: 'Debt ID not found in URL' });

	const { error: apiError } = await locals.api.v1.debts({ id: debtId }).suggest.post({
		amount: amount ? Number(amount) : undefined,
		description: description || undefined
	});
	if (apiError) {
		parseApiFailure(apiError, 'Failed to suggest edit');
	}

	return { success: true, message: 'Edit suggestion sent' };
});

export const respondSuggestion = form('unchecked' as const, async (data) => {
	const locals = ensureAuthenticated();
	const { params } = getRequestEvent();

	const accept = typeof data.accept === 'string' ? data.accept : '';
	const debtId = params.id;
	if (!debtId) error(400, { code: 'BAD_REQUEST', message: 'Debt ID not found in URL' });

	const { error: apiError } = await locals.api.v1.debts({ id: debtId }).suggestion.respond.post({ accept: accept === 'true' });
	if (apiError) {
		parseApiFailure(apiError, 'Failed to respond to suggestion');
	}

	return { success: true, accepted: accept === 'true' };
});

export const uploadProof = form('unchecked' as const, async (data) => {
	const locals = ensureAuthenticated();
	const { params } = getRequestEvent();

	const proof = data.proof as File;
	const debtId = params.id;
	if (!debtId) error(400, { code: 'BAD_REQUEST', message: 'Debt ID not found in URL' });

	const { error: apiError } = await locals.api.v1.storage['payment-proof']({ debtId }).post({ file: proof });
	if (apiError) {
		parseApiFailure(apiError, 'Failed to upload proof');
	}

	return { success: true, message: 'Proof uploaded successfully' };
});
