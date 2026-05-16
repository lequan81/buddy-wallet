import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { getAuthHeaders } from '$lib/services/api';
import { SERVER_API_URL } from '$lib/server/api-url';

import { getDashboardDebts, getDashboardUsers, getDashboardSecondaryData, getRecentDebts } from '$lib/remotes/dashboard.remote';

export const load: PageServerLoad = async ({ locals, parent }) => {
	const { permissions } = await parent();

	const usersPromise = getDashboardUsers(permissions.canManageUsers);
	// Load all debts client-side for snappy, seamless filtering
	const debtsPromise = getDashboardDebts({ statusFilter: 'all', page: 1, pageSize: 1000 });

	const { hasBankAccount, recentContacts } = await getDashboardSecondaryData();
	const recentDebtsPromise = getRecentDebts();

	return {
		streamed: {
			users: usersPromise,
			debtsData: debtsPromise,
			recentDebts: recentDebtsPromise
		},
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
				error: (data?.message || 'Export failed')
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
