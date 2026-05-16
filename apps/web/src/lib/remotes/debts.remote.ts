import { form, getRequestEvent } from '$app/server';
import { invalid, error } from '@sveltejs/kit';
import { normalizeDebtIdList } from '$lib/services/debt-batch';
import { unwrapData } from '$lib/services/api-helpers';

type ApiErrorResult = {
	value?: unknown;
	status?: number;
};

const ensureAuthenticated = () => {
	const { locals } = getRequestEvent();
	if (!locals.user) {
		error(401, { code: 'UNAUTHORIZED', message: 'Unauthorized' });
	}
	return locals;
};

const parseApiFailure = (apiError: ApiErrorResult | null | undefined, fallbackMessage: string): never => {
	const message = (apiError?.value as { message?: string })?.message || fallbackMessage;
	invalid(message);
};

// ─── Debt CRUD ───────────────────────────────────────────────────────────────

export const createDebtRemote = form('unchecked' as const, async (data) => {
	const locals = ensureAuthenticated();

	const counterpartyPhone = typeof data.counterpartyPhone === 'string' ? data.counterpartyPhone : '';
	const amount = typeof data.amount === 'string' ? Number(data.amount) : typeof data.amount === 'number' ? data.amount : 0;
	const description = typeof data.description === 'string' ? data.description : '';
	const direction = typeof data.direction === 'string' ? data.direction : '';
	const expiryOption = typeof data.expiryOption === 'string' ? data.expiryOption : undefined;
	const confirmDuplicate = data.confirmDuplicate === 'true' || data.confirmDuplicate === true;

	if (!counterpartyPhone || amount <= 0 || !description || !direction) {
		invalid('Missing required fields');
		return;
	}

	// Resolve expiry to a date
	let dueDate: Date | undefined;
	if (expiryOption && expiryOption !== 'never') {
		const days = parseInt(expiryOption);
		if (!isNaN(days)) {
			dueDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
		}
	}

	// The API handler resolves debtorPhone/creditorPhone and determines roles based on direction.
	// We send phone-based fields; the handler looks up users server-side.
	// ensureAuthenticated() guarantees locals.user is non-null.
	const userPhone = locals.user!.phoneNumber ?? '';
	const isLend = direction === 'LEND';
	const body = {
		amount,
		currency: 'VND',
		description,
		dueDate,
		// When LENDING: current user is creditor, counterparty is debtor
		// When BORROWING: current user is debtor, counterparty is creditor
		debtorPhone: isLend ? counterpartyPhone : userPhone,
		creditorPhone: isLend ? userPhone : counterpartyPhone,
		// Pass a placeholder debtorId to satisfy the Elysia schema; the handler resolves by phone
		debtorId: '00000000-0000-0000-0000-000000000000'
	};

	const { data: responseData, error: apiError } = await locals.api.v1.debts.post(body);

	if (apiError) {
		parseApiFailure(apiError, 'Failed to create debt');
	}

	const resData = unwrapData<{ duplicates?: unknown[]; id?: string }>(responseData);

	if (resData?.duplicates && resData.duplicates.length > 0 && !confirmDuplicate) {
		return {
			code: 'DUPLICATE_WARNING',
			duplicates: resData.duplicates,
			success: false
		};
	}

	return { success: true, id: resData?.id, message: 'Debt created successfully' };
});

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

	const resData = unwrapData<{ deleted?: string[] }>(responseData);
	const deletedCount = resData?.deleted?.length ?? ids.length;
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

	const resData = unwrapData<{ deleted?: number }>(responseData);
	return { success: true, deleted: resData?.deleted ?? 0 };
});

// ─── Debt Status Transitions ─────────────────────────────────────────────────

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

// ─── Suggestion Operations ───────────────────────────────────────────────────

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
