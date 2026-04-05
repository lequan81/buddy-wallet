import { form, getRequestEvent } from '$app/server';
import { invalid, error } from '@sveltejs/kit';
import * as v from 'valibot';

export const batchDeleteDebts = form(
	v.object({
		ids: v.array(v.string())
	}),
	async ({ ids }) => {
		const { locals } = getRequestEvent();
		if (!locals.user) error(401, { code: 'UNAUTHORIZED', message: 'Unauthorized' });

		if (ids.length === 0) {
			invalid('No debts selected');
		}

		if (ids.length > 50) {
			invalid('Cannot delete more than 50 debts at once');
		}

		const { error: apiError } = await locals.api.v1.debts.batch.delete({ ids });

		if (apiError) {
			const errVal = apiError.value as Record<string, unknown>;
			const errorMsg =
				(errVal?.message as string) ||
				(errVal?.details as string) ||
				'Failed to delete debts';
			invalid(errorMsg);
		}

		return { success: true, deleted: ids.length };
	}
);

export const deleteDebt = form(
	v.object({
		id: v.string()
	}),
	async ({ id }) => {
		const { locals } = getRequestEvent();
		if (!locals.user) error(401, { code: 'UNAUTHORIZED', message: 'Unauthorized' });

		const { error: apiError } = await locals.api.v1.debts({ id }).delete();

		if (apiError) {
			const errVal = apiError.value as Record<string, unknown>;
			const errorMsg =
				(errVal?.message as string) ||
				(errVal?.details as string) ||
				'Failed to delete debt';
			invalid(errorMsg);
		}

		return { success: true, deleted: 1 };
	}
);

export const deleteAllDebts = form(
	v.object({
		confirm: v.literal('true')
	}),
	async () => {
		const { locals } = getRequestEvent();
		if (!locals.user) error(401, { code: 'UNAUTHORIZED', message: 'Unauthorized' });

		const { data, error: apiError } = await locals.api.v1.debts.all.delete(
			{},
			{ query: { confirm: 'true' } }
		);

		if (apiError) {
			const errVal = (apiError as Record<string, unknown>)?.value as Record<string, unknown>;
			const errorMsg =
				(errVal?.message as string) ||
				(errVal?.details as string) ||
				'Failed to delete all debts';
			invalid(errorMsg);
		}

		return { success: true, deleted: data?.deleted ?? 0 };
	}
);

export const updateDebtStatus = form(
	v.object({
		status: v.picklist(['pending', 'confirmed', 'paid', 'disputed', 'cancelled'])
	}),
	async ({ status }) => {
		const { locals, params } = getRequestEvent();
		if (!locals.user) error(401, { code: 'UNAUTHORIZED', message: 'Unauthorized' });

		const debtId = params.id;
		if (!debtId) error(400, { code: 'BAD_REQUEST', message: 'Debt ID not found in URL' });

		const { error: apiError } = await locals.api.v1.debts({ id: debtId }).status.patch({ status });

		if (apiError) {
			const errVal = apiError.value as Record<string, unknown>;
			invalid((errVal?.message as string) || (errVal?.details as string) || 'Failed to update status');
		}

		return { success: true, status };
	}
);

export const updateDebt = form(
	v.object({
		description: v.optional(v.string()),
		amount: v.optional(v.string())
	}),
	async ({ description, amount }) => {
		const { locals, params } = getRequestEvent();
		if (!locals.user) error(401, { code: 'UNAUTHORIZED', message: 'Unauthorized' });

		const debtId = params.id;
		if (!debtId) error(400, { code: 'BAD_REQUEST', message: 'Debt ID not found in URL' });

		const body: Record<string, unknown> = {};
		if (description) body.description = description;
		if (amount) body.amount = Number(amount);

		const { error: apiError } = await locals.api.v1.debts({ id: debtId }).put(body);

		if (apiError) {
			const errVal = apiError.value as Record<string, unknown>;
			invalid((errVal?.message as string) || (errVal?.details as string) || 'Failed to update debt');
		}

		return { success: true, message: 'Debt updated successfully' };
	}
);

export const confirmDebt = form(
	v.object({}),
	async () => {
		const { locals, params } = getRequestEvent();
		if (!locals.user) error(401, { code: 'UNAUTHORIZED', message: 'Unauthorized' });

		const debtId = params.id;
		if (!debtId) error(400, { code: 'BAD_REQUEST', message: 'Debt ID not found in URL' });

		const { error: apiError } = await locals.api.v1.debts({ id: debtId }).confirm.post();

		if (apiError) {
			const errVal = apiError.value as Record<string, unknown>;
			invalid((errVal?.message as string) || (errVal?.details as string) || 'Failed to confirm debt');
		}

		return { success: true, message: 'Debt confirmed successfully' };
	}
);

export const approveProof = form(
	v.object({
		proofId: v.string()
	}),
	async ({ proofId }) => {
		const { locals } = getRequestEvent();
		if (!locals.user) error(401, { code: 'UNAUTHORIZED', message: 'Unauthorized' });

		const { data, error: apiError } = await locals.api.v1.upload.proof({ id: proofId }).approve.post();

		if (apiError) {
			const errVal = apiError.value as Record<string, unknown>;
			invalid((errVal?.message as string) || (errVal?.details as string) || 'Failed to approve proof');
		}

		const responseData = data as { allProofsApproved?: boolean; debtId?: string } | null;
		return {
			success: true,
			message: 'Proof approved successfully',
			allProofsApproved: responseData?.allProofsApproved || false,
			debtId: responseData?.debtId || null
		};
	}
);

export const rejectProof = form(
	v.object({
		proofId: v.string(),
		reason: v.optional(v.string())
	}),
	async ({ proofId, reason }) => {
		const { locals } = getRequestEvent();
		if (!locals.user) error(401, { code: 'UNAUTHORIZED', message: 'Unauthorized' });

		const { error: apiError } = await locals.api.v1.upload.proof({ id: proofId }).reject.post({ reason });

		if (apiError) {
			const errVal = apiError.value as Record<string, unknown>;
			invalid((errVal?.message as string) || (errVal?.details as string) || 'Failed to reject proof');
		}

		return { success: true, message: 'Proof rejected successfully' };
	}
);

export const suggestEdit = form(
	v.object({
		amount: v.optional(v.string()),
		description: v.optional(v.string())
	}),
	async ({ amount, description }) => {
		const { locals, params } = getRequestEvent();
		if (!locals.user) error(401, { code: 'UNAUTHORIZED', message: 'Unauthorized' });

		const debtId = params.id;
		if (!debtId) error(400, { code: 'BAD_REQUEST', message: 'Debt ID not found in URL' });

		if (!amount && !description) {
			invalid('Please provide at least amount or description');
		}

		const { error: apiError } = await locals.api.v1.debts({ id: debtId }).suggest.post({
			amount: amount ? Number(amount) : undefined,
			description: description || undefined
		});

		if (apiError) {
			const errVal = apiError.value as Record<string, unknown>;
			invalid((errVal?.message as string) || (errVal?.details as string) || 'Failed to submit suggestion');
		}

		return { success: true, message: 'Edit suggestion sent' };
	}
);

export const respondSuggestion = form(
	v.object({
		accept: v.picklist(['true', 'false'])
	}),
	async ({ accept }) => {
		const { locals, params } = getRequestEvent();
		if (!locals.user) error(401, { code: 'UNAUTHORIZED', message: 'Unauthorized' });

		const debtId = params.id;
		if (!debtId) error(400, { code: 'BAD_REQUEST', message: 'Debt ID not found in URL' });

		const { error: apiError } = await locals.api.v1.debts({ id: debtId }).suggestion.respond.post({ accept: accept === 'true' });

		if (apiError) {
			const errVal = apiError.value as Record<string, unknown>;
			invalid((errVal?.message as string) || (errVal?.details as string) || 'Failed to respond to suggestion');
		}

		return { success: true, message: accept === 'true' ? 'Suggestion accepted' : 'Suggestion rejected' };
	}
);

export const uploadProof = form(
	v.object({
		proof: v.file()
	}),
	async ({ proof }) => {
		const { locals, params } = getRequestEvent();
		if (!locals.user) error(401, { code: 'UNAUTHORIZED', message: 'Unauthorized' });

		const debtId = params.id;
		if (!debtId) error(400, { code: 'BAD_REQUEST', message: 'Debt ID not found in URL' });

		const { error: apiError } = await locals.api.v1.upload['payment-proof']({ debtId }).post({ file: proof as File });

		if (apiError) {
			const errVal = apiError.value as Record<string, unknown>;
			invalid((errVal?.message as string) || (errVal?.details as string) || 'Failed to upload proof');
		}

		return { success: true, message: 'Proof uploaded successfully' };
	}
);
