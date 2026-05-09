import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { getAuthHeaders } from '$lib/services/api';
import { SERVER_API_URL } from '$lib/server/api-url';
import { extractApiErrorMessage } from '$lib/services/api-envelope';

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
		// Keep raw fetch for file download - Treaty doesn't handle non-JSON responses well
		const headers = getAuthHeaders(locals.accessToken);
		const res = await fetch(`${SERVER_API_URL}/v1/data/export?type=debts&format=csv`, { headers });
		if (!res.ok) {
			const data = await res.json().catch(() => ({}));
			return fail(res.status, {
				error: extractApiErrorMessage(data, 'Export failed')
			});
		}
		const contentType = res.headers.get('Content-Type') ?? 'text/csv; charset=utf-8';
		const contentDisposition = res.headers.get('Content-Disposition') ?? 'attachment; filename="debts_export.csv"';
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
