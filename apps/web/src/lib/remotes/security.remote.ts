import { form, getRequestEvent } from '$app/server';
import { invalid, redirect } from '@sveltejs/kit';
import { Type } from '@sinclair/typebox';
import { changePasswordSchema } from '@repo/schema/dto/auth';
import { toStandardSchema } from '@repo/schema/adapters/standard-schema';
import { extractApiData, extractApiErrorMessage } from '$lib/services/api-envelope';

export const revokeSession = form(
	toStandardSchema(
		Type.Object({
			sessionId: Type.String()
		})
	),
	async ({ sessionId: _sessionId }) => {
		const { locals } = getRequestEvent();
		if (!locals.user) invalid('Unauthorized');

		invalid('Session revocation endpoint is not available');
	}
);

export const logoutAll = form(toStandardSchema(Type.Object({})), async () => {
	const { locals, cookies } = getRequestEvent();
	if (!locals.user) invalid('Unauthorized');

	const { error } = await locals.api.v1.auth.logout.post({ allDevices: true });
	if (error) {
		invalid(extractApiErrorMessage(error.value, 'Failed to logout all devices'));
	}

	cookies.delete('session', { path: '/' });
	cookies.delete('refresh_token', { path: '/' });

	throw redirect(303, '/login?reason=logout_all');
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
			invalid(extractApiErrorMessage(error.value, 'Failed to change password'));
		}

		const parsed = extractApiData<{ message?: string }>(data);
		return {
			success: true,
			message: parsed.message || parsed.data?.message || 'Password changed successfully'
		};
	}
);
