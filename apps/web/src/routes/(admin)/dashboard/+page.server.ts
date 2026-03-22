import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { getAuthHeaders } from '$lib/services/api';
import { SERVER_API_URL } from '$lib/server/api-url';

import { getDashboardDebts, getDashboardUsers, getDashboardSecondaryData, getRecentDebts } from '$lib/remotes/dashboard.remote';

export const load: PageServerLoad = async ({ locals, parent, url }) => {
	const statusFilter = url.searchParams.get('status') || 'all';
	const page = parseInt(url.searchParams.get('page') || '1');
	const pageSize = parseInt(url.searchParams.get('pageSize') || '10');

	const { permissions } = await parent();

	const usersPromise = getDashboardUsers(permissions.canManageUsers);
	const debtsPromise = getDashboardDebts({ statusFilter, page, pageSize });
	
	const { hasBankAccount, recentContacts } = await getDashboardSecondaryData();
	const recentDebtsPromise = getRecentDebts();

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
	}
};
