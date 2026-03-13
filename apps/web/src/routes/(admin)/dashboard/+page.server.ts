import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { getAuthHeaders } from '$lib/services/api';
import { SERVER_API_URL } from '$lib/server/api-url';

export const load: PageServerLoad = async ({ locals, parent, url }) => {
	const statusFilter = url.searchParams.get('status') || 'all';
	const page = parseInt(url.searchParams.get('page') || '1');
	const pageSize = parseInt(url.searchParams.get('pageSize') || '10');
	const offset = (page - 1) * pageSize;

	// Get server-computed permissions from layout
	const { permissions } = await parent();

	// Only fetch users if server says user can manage them
	// We do NOT await here - we return the promise to stream it
	const usersPromise = permissions.canManageUsers
		? locals.api.v1.users
				.get()
				.then(({ data }) => data?.users || [])
		: Promise.resolve([]);

	// Build debts query params
	const debtsQuery: Record<string, string> = {
		limit: pageSize.toString(),
		offset: offset.toString()
	};
	if (statusFilter !== 'all') {
		debtsQuery.status = statusFilter;
	}

	// We do NOT await here either
	const debtsPromise = locals.api.v1.debts
		.get({ query: debtsQuery })
		.then(({ data }) => {
			return {
				debts: data?.debts || [],
				pagination: data?.pagination || { total: 0, limit: pageSize, offset: 0, hasMore: false }
			};
		})
		.catch(() => ({
			debts: [],
			pagination: { total: 0, limit: pageSize, offset: 0, hasMore: false }
		}));

	let hasBankAccount = false;
	let recentContacts: string[] = [];
	try {
		const [bankRes, contactsRes] = await Promise.all([
			locals.api.v1.banks.me.get(),
			locals.api.v1.debts['recent-contacts'].get()
		]);
		hasBankAccount = !!(bankRes.data?.success && bankRes.data.accounts && bankRes.data.accounts.length > 0);
		recentContacts = contactsRes.data?.contacts || [];
	} catch (err) {
		console.error('[Dashboard] Failed to load bank/contacts:', err);
	}

	// Stream recent debts for QuickActions (no await - streamed to client)
	const recentDebtsPromise = locals.api.v1.debts.recent
		.get()
		.then(({ data }) => data?.debts || [])
		.catch(() => []);

	return {
		streamed: {
			users: usersPromise,
			debtsData: debtsPromise,
			recentDebts: recentDebtsPromise
		},
		statusFilter,
		page,
		pageSize,
		currentUser: locals.user,
		hasBankAccount,
		recentContacts
	};
};

export const actions: Actions = {
	exportDebts: async ({ locals, fetch }) => {
		if (!locals.user || !locals.accessToken) {
			return fail(401, { error: 'Unauthorized' });
		}
		// Keep raw fetch for binary file download - Treaty doesn't handle binary responses
		const headers = getAuthHeaders(locals.accessToken);
		const res = await fetch(`${SERVER_API_URL}/v1/export/debts`, { headers });
		if (!res.ok) {
			const data = await res.json().catch(() => ({}));
			return fail(res.status, {
				error: (data?.message ?? data?.error) || 'Export failed'
			});
		}
		const contentType =
			res.headers.get('Content-Type') ?? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
		const contentDisposition =
			res.headers.get('Content-Disposition') ?? 'attachment; filename="debts.xlsx"';
		const buffer = await res.arrayBuffer();
		return new Response(buffer, {
			status: 200,
			headers: {
				'Content-Type': contentType,
				'Content-Disposition': contentDisposition
			}
		});
	},

	batchDelete: async ({ locals, request }) => {
		if (!locals.user) {
			return fail(401, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const idsRaw = formData.get('ids') as string;

		if (!idsRaw) {
			return fail(400, { error: 'No debts selected' });
		}

		const ids = idsRaw.split(',').filter(Boolean);

		if (ids.length === 0) {
			return fail(400, { error: 'No debts selected' });
		}

		if (ids.length > 50) {
			return fail(400, { error: 'Cannot delete more than 50 debts at once' });
		}

		const { error, status } = await locals.api.v1.debts.batch.delete({ ids });

		if (error) {
			const errVal = error.value as Record<string, unknown>;
			const errorMsg =
				(errVal?.message as string) ||
				(errVal?.details as string) ||
				'Failed to delete debts';
			return fail(typeof status === 'number' ? status : 500, { error: errorMsg });
		}

		return { success: true, deleted: ids.length };
	},

	delete: async ({ locals, request }) => {
		if (!locals.user) {
			return fail(401, { error: 'Unauthorized' });
		}

		const formData = await request.formData();
		const id = formData.get('id') as string;

		if (!id) {
			return fail(400, { error: 'No debt selected' });
		}

		const { error, status } = await locals.api.v1.debts({ id }).delete();

		if (error) {
			const errVal = error.value as Record<string, unknown>;
			const errorMsg =
				(errVal?.message as string) ||
				(errVal?.details as string) ||
				'Failed to delete debt';
			return fail(typeof status === 'number' ? status : 500, { error: errorMsg });
		}

		return { success: true, deleted: 1 };
	},

	deleteAll: async ({ locals }) => {
		if (!locals.user) {
			return fail(401, { error: 'Unauthorized' });
		}

		const { data, error, status } = await locals.api.v1.debts.all.delete({
			query: { confirm: 'true' }
		});

		if (error) {
			const errVal = (error as Record<string, unknown>)?.value as Record<string, unknown>;
			const errorMsg =
				(errVal?.message as string) ||
				(errVal?.details as string) ||
				'Failed to delete all debts';
			return fail(typeof status === 'number' ? status : 500, { error: errorMsg });
		}

		return { success: true, deleted: data?.deleted ?? 0 };
	}
};
