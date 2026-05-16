import { form, getRequestEvent } from '$app/server';
import { invalid } from '@sveltejs/kit';
import { redirect } from '$lib/services/navigation';
import * as v from 'valibot';
import { changePasswordSchema } from '@repo/schema/dto/auth';
import { toStandardSchema } from '@repo/schema/adapters/standard-schema';
import { unwrapData } from '$lib/services/api-helpers';

export const revokeSession = form(
	toStandardSchema(
		v.object({
			sessionId: v.string()
		})
	),
	async ({ sessionId: _sessionId }) => {
		const { locals } = getRequestEvent();
		if (!locals.user) invalid('Unauthorized');

		invalid('Session revocation endpoint is not available');
	}
);

export const logoutAll = form(toStandardSchema(v.object({})), async () => {
	const { locals, cookies } = getRequestEvent();
	if (!locals.user) invalid('Unauthorized');

	const { error } = await locals.api.v1.auth.logout.post({ allDevices: true });
	if (error) {
		invalid(((error.value as { message?: string })?.message || 'Failed to logout all devices'));
	}

	cookies.delete('session', { path: '/' });
	cookies.delete('refresh_token', { path: '/' });

	redirect(303, '/login', { reason: 'logout_all' });
});

export const changePassword = form(
	toStandardSchema(changePasswordSchema),
	async ({ currentPassword, newPassword, confirmPassword: _confirmPassword }) => {
		const { locals } = getRequestEvent();
		if (!locals.user) invalid('Unauthorized');

		const { data, error } = await locals.api.v1.user['change-password'].post({
			currentPassword,
			newPassword
		});

		if (error) {
			invalid(((error.value as { message?: string })?.message || 'Failed to change password'));
		}

		const resData = unwrapData<{ message?: string }>(data);
		return {
			success: true,
			message: resData?.message || 'Password changed successfully'
		};
	}
);
