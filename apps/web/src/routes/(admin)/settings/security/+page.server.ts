import type { PageServerLoad, Actions } from './$types';
import { serverFetch, API_URL, getDefaultHeaders } from '$lib/api';
import { fail, redirect } from '@sveltejs/kit';

interface Session {
	id: string;
	deviceName: string | null;
	deviceType: string | null;
	location: string | null;
	lastActiveAt: string | null;
	createdAt: string;
	isCurrent: boolean;
}

interface SessionsResponse {
	sessions: Session[];
	currentSessionId: string;
}

export const load: PageServerLoad = async ({ cookies, locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const cookieHeader = cookies
		.getAll()
		.map((c) => `${c.name}=${c.value}`)
		.join('; ');

	const { data, error } = await serverFetch<SessionsResponse>('/v1/auth/sessions', {
		cookies: cookieHeader
	});

	// serverFetch already unwraps { success, data } to just data
	return {
		sessions: data?.sessions || [],
		currentSessionId: data?.currentSessionId || '',
		error
	};
};

export const actions: Actions = {
	revokeSession: async ({ request, cookies }) => {
		const formData = await request.formData();
		const sessionId = formData.get('sessionId') as string;

		if (!sessionId) {
			return fail(400, { message: 'Session ID is required' });
		}

		const cookieHeader = cookies
			.getAll()
			.map((c) => `${c.name}=${c.value}`)
			.join('; ');

		const response = await fetch(`${API_URL}/v1/auth/sessions/${sessionId}/revoke`, {
			method: 'POST',
			headers: {
				...getDefaultHeaders(),
				Cookie: cookieHeader
			}
		});

		const data = await response.json().catch(() => ({}));

		if (!response.ok) {
			const errorMsg = data.error?.message || data.error?.details || data.message || 'Failed to revoke session';
			return fail(response.status, { message: errorMsg });
		}

		return { success: true, message: 'Session revoked successfully' };
	},

	logoutAll: async ({ cookies }) => {
		const cookieHeader = cookies
			.getAll()
			.map((c) => `${c.name}=${c.value}`)
			.join('; ');

		const response = await fetch(`${API_URL}/v1/auth/logout-all`, {
			method: 'POST',
			headers: {
				...getDefaultHeaders(),
				Cookie: cookieHeader
			}
		});

		const data = await response.json().catch(() => ({}));

		if (!response.ok) {
			const errorMsg = data.error?.message || data.error?.details || data.message || 'Failed to logout all devices';
			return fail(response.status, { message: errorMsg });
		}

		// Clear cookies and redirect to login
		cookies.delete('session', { path: '/' });
		cookies.delete('refresh', { path: '/' });

		throw redirect(302, '/login?reason=logout_all');
	},

	changePassword: async ({ request, cookies }) => {
		const formData = await request.formData();
		const currentPassword = formData.get('currentPassword') as string;
		const newPassword = formData.get('newPassword') as string;
		const confirmPassword = formData.get('confirmPassword') as string;

		if (!currentPassword || !newPassword || !confirmPassword) {
			return fail(400, { message: 'All fields are required' });
		}

		if (newPassword !== confirmPassword) {
			return fail(400, { message: 'New passwords do not match' });
		}

		if (newPassword.length < 8) {
			return fail(400, { message: 'Password must be at least 8 characters' });
		}

		const cookieHeader = cookies
			.getAll()
			.map((c) => `${c.name}=${c.value}`)
			.join('; ');

		const response = await fetch(`${API_URL}/v1/auth/change-password`, {
			method: 'POST',
			headers: {
				...getDefaultHeaders(),
				'Content-Type': 'application/json',
				Cookie: cookieHeader
			},
			body: JSON.stringify({ currentPassword, newPassword })
		});

		const data = await response.json().catch(() => ({}));

		if (!response.ok) {
			const errorMsg = data.error?.message || data.error?.details || data.message || 'Failed to change password';
			return fail(response.status, { message: errorMsg });
		}

		return { success: true, message: data.data?.message || data.message || 'Password changed successfully' };
	}
};
