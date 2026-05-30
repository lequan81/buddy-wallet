import { form, getRequestEvent } from '$app/server';
import { invalid, error } from '@sveltejs/kit';
import { unwrapData } from '$lib/services/api-helpers';
import * as v from 'valibot';
import { toStandardSchema } from '@repo/schema/adapters/standard-schema';

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

// ─── Proof Operations ────────────────────────────────────────────────────────
// Routes under /v1/proof (dedicated proof module)
// NOTE: These use direct fetch until the API types are rebuilt to include the proof module.
// Once types include proof, switch to: api.v1.proof({ proofId }).approve.post()

export const approveProof = form('unchecked' as const, async (data) => {
	ensureAuthenticated();

	const proofId = typeof data.proofId === 'string' ? data.proofId : '';
	if (!proofId) {
		invalid('Proof ID is required');
		return;
	}

	const { fetch: reqFetch } = getRequestEvent();
	const res = await reqFetch(`/v1/proof/${proofId}/approve`, { method: 'POST' }).then(r => r.json());
	const { data: responseData, error: apiError } = res;
	if (apiError) {
		parseApiFailure(apiError, 'Failed to approve proof');
	}

	const resData = unwrapData<unknown>(responseData);
	return { success: true, approved: true, data: resData };
});

export const rejectProof = form('unchecked' as const, async (data) => {
	ensureAuthenticated();

	const proofId = typeof data.proofId === 'string' ? data.proofId : '';
	const reason = typeof data.reason === 'string' ? data.reason : undefined;
	if (!proofId) {
		invalid('Proof ID is required');
		return;
	}

	const { fetch: reqFetch } = getRequestEvent();
	const res = await reqFetch(`/v1/proof/${proofId}/reject`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ reason })
	}).then(r => r.json());
	const { error: apiError } = res;
	if (apiError) {
		parseApiFailure(apiError, 'Failed to reject proof');
	}

	return { success: true, rejected: true };
});

export const uploadProof = form(
	toStandardSchema(
		v.object({
			proof: v.any()
		})
	),
	async ({ proof }) => {
		ensureAuthenticated();
		const { params } = getRequestEvent();

		const proofFile = proof as File;
		const debtId = params.id;
		if (!debtId) error(400, { code: 'BAD_REQUEST', message: 'Debt ID not found in URL' });

		const { fetch: reqFetch } = getRequestEvent();
		const formData = new FormData();
		formData.append('file', proofFile);

		const res = await reqFetch(`/v1/proof/${debtId}/upload`, {
			method: 'POST',
			body: formData
		}).then(r => r.json());
		const { error: apiError } = res;
		if (apiError) {
			parseApiFailure(apiError, 'Failed to upload proof');
		}

		return { success: true, message: 'Proof uploaded successfully' };
	}
);
