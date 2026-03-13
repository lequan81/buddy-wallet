import type { PageServerLoad, Actions } from './$types';
import type { SessionsResponse } from '@repo/types';
import { fail, redirect } from '@sveltejs/kit';
import { changePasswordSchema, v } from '@repo/validation/client';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const { api } = locals;
	const { data, error } = await api.v1.auth.sessions.get();

	const sessionData = data as SessionsResponse | undefined;

	return {
		sessions: sessionData?.sessions || [],
		currentSessionId: sessionData?.currentSessionId || '',
		error: error ? error.value : null
	};
};

export const actions: Actions = {
	revokeSession: async ({ request, locals }) => {
		const formData = await request.formData();
		const sessionId = formData.get('sessionId') as string;

		if (!sessionId) {
			return fail(400, { message: 'Session ID is required' });
		}

		const { api } = locals;
		const { error, status } = await api.v1.auth.sessions({ sessionId }).revoke.post();

		if (error) {
			const errorMsg = error.value?.message || (error.value as any)?.details || 'Failed to revoke session';
			return fail(status, { message: errorMsg });
		}

		return { success: true, message: 'Session revoked successfully' };
	},

	logoutAll: async ({ cookies, locals }) => {
		const { api } = locals;
		const { error, status } = await api.v1.auth['logout-all'].post();

		if (error) {
			const errorMsg = (error.value as any)?.message || (error.value as any)?.details || 'Failed to logout all devices';
			return fail(status, { message: errorMsg });
		}

		// Clear cookies and redirect to login
		cookies.delete('session', { path: '/' });
		cookies.delete('refresh_token', { path: '/' });

		throw redirect(302, '/login?reason=logout_all');
	},

	changePassword: async ({ request, locals }) => {
		const formData = await request.formData();
		const currentPassword = formData.get('currentPassword') as string;
		const newPassword = formData.get('newPassword') as string;
		const confirmPassword = formData.get('confirmPassword') as string;

		const result = v.safeParse(changePasswordSchema, {
			currentPassword,
			newPassword,
			confirmPassword
		});

		if (!result.success) {
			return fail(400, { message: result.issues[0].message });
		}

		const { api } = locals;
		const { data, error, status } = await api.v1.auth['change-password'].post({
			currentPassword,
			newPassword
		});

		if (error) {
			const errorMsg = error.value?.message || (error.value as any)?.details || 'Failed to change password';
			return fail(status, { message: errorMsg });
		}

		return {
			success: true,
			// @ts-expect-error Value parsing
			message: data?.message || 'Password changed successfully'
		};
	}
};
