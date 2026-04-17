import { form, getRequestEvent } from '$app/server';
import { invalid, redirect } from '@sveltejs/kit';
import { v, changePasswordSchema } from '@repo/validation/client';

export const revokeSession = form(
	v.object({
		sessionId: v.string()
	}),
	async ({ sessionId }) => {
		const { locals } = getRequestEvent();
		if (!locals.user) invalid('Unauthorized');

		const { error } = await locals.api.v1.auth.sessions({ sessionId }).revoke.post();

		if (error) {
			const errVal = error.value as Record<string, unknown>;
			invalid((errVal?.message as string) || (errVal?.details as string) || 'Failed to revoke session');
		}

		return { success: true, message: 'Session revoked successfully' };
	}
);

export const logoutAll = form(
	v.object({}),
	async () => {
		const { locals, cookies } = getRequestEvent();
		if (!locals.user) invalid('Unauthorized');

		const { error } = await locals.api.v1.auth['logout-all'].post();

		if (error) {
			const errVal = error.value as Record<string, unknown>;
			invalid((errVal?.message as string) || (errVal?.details as string) || 'Failed to logout all devices');
		}

		cookies.delete('session', { path: '/' });
		cookies.delete('refresh_token', { path: '/' });

		throw redirect(303, '/login?reason=logout_all');
	}
);

export const changePassword = form(
	changePasswordSchema,
	async ({ currentPassword, newPassword, confirmPassword }) => {
		const { locals } = getRequestEvent();
		if (!locals.user) invalid('Unauthorized');

		// The schema matches what the API expects
		const { data, error }: { data: any, error: any } = await locals.api.v1.auth['change-password'].post({
			currentPassword,
			newPassword
		});

		if (error) {
			const errVal = error.value as Record<string, unknown>;
			invalid((errVal?.message as string) || (errVal?.details as string) || 'Failed to change password');
		}

		return {
			success: true,
			message: data?.message || 'Password changed successfully'
		};
	}
);
