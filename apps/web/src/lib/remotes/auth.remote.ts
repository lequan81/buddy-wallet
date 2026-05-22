import { form, getRequestEvent } from '$app/server';
import { invalid } from '@sveltejs/kit';
import { createTreatyClient } from '$lib/services/api';
import {
	loginRequestSchema as loginSchema,
	registerRequestSchema,
	resetPasswordSchema
} from '@repo/schema/dto/auth';
import { toStandardSchema } from '@repo/schema/adapters/standard-schema';
import { unwrapData, syncCookiesFromResponse } from '$lib/services/api-helpers';
import { redirect, getParam } from '$lib/services/navigation';
import * as v from 'valibot';

export const loginRemote = form(toStandardSchema(loginSchema), async ({ email, password }) => {
	const event = getRequestEvent();
	const { request, fetch, cookies } = event;
	const redirectTo = '/';

	try {
		const api = createTreatyClient(fetch);
		const { data, error, response } = await api.v1.auth.login.post(
			{ identifier: email, password },
			{
				headers: {
					'User-Agent': request.headers.get('user-agent') || ''
				}
			}
		);

		if (error) {
			invalid((error.value?.message || 'Login failed'));
		}

		// data is the success envelope { data, message, meta }
		const loginData = unwrapData<{ mustChangePassword?: boolean }>(data);
		
		if (loginData !== null) {
			// Extract and set session cookies from the API response
			syncCookiesFromResponse(response, cookies);

			// If user must change password, redirect to change-password page
			if (loginData.mustChangePassword) {
				redirect(303, '/change-password', { required: true });
			}

			// Normal successful login — redirect to destination
			redirect(303, redirectTo);
		}

		invalid('Unexpected error occurred');
	} catch (err) {
		if (err && typeof err === 'object' && ('status' in err || 'location' in err || 'issues' in err)) {
			throw err;
		}
		console.error('[auth.remote:loginRemote] Unexpected Error:', err);
		invalid(`Unable to connect to server: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again later.`);
	}
});

export const registerRemote = form(
	toStandardSchema(registerRequestSchema),
	async ({ name, phoneNumber, email, password }) => {
		const event = getRequestEvent();
		const { fetch, cookies } = event;

		try {
			const api = createTreatyClient(fetch);
			const { data, error, response } = await api.v1.auth.register.post({
				fullName: name,
				phone: phoneNumber,
				email: email || undefined,
				password
			});

			if (error) {
				let errorMessage = (error.value?.message || 'Registration failed');

				if (
					errorMessage.toLowerCase().includes('already exists') ||
					errorMessage.toLowerCase().includes('duplicate')
				) {
					errorMessage =
						'An account with this phone number or email already exists. Please log in instead.';
				}

				invalid(errorMessage);
			}

			if (data) {
				// Extract and set session cookies from the API response
				syncCookiesFromResponse(response, cookies);
			}

			// If email provided, set cookie and redirect to verify-email
			if (email) {
				cookies.set('pending_verification_email', email, {
					path: '/',
					httpOnly: true,
					maxAge: 600 // 10 minutes
				});
				redirect(303, '/verify-email');
			}

			// No email (phone-only signup) — go straight to the home/dashboard
			redirect(303, '/');
		} catch (err) {
			if (err && typeof err === 'object' && ('status' in err || 'location' in err || 'issues' in err)) {
				throw err;
			}
			console.error('[auth.remote:registerRemote] Unexpected Error:', err);
			invalid(`Unable to connect to server: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again later.`);
		}
	}
);

export const resetPasswordRemote = form(
	toStandardSchema(resetPasswordSchema),
	async ({ password }) => {
		const event = getRequestEvent();
		const { url, fetch } = event;

		const token = getParam(url, 'token');
		const email = getParam(url, 'email');

		if (!token || !email) {
			invalid('Missing reset token or email. Please use the link from your email.');
		}

		try {
			const api = createTreatyClient(fetch);
			const { error } = await api.v1.auth['reset-password'].post({
				token,
				newPassword: password
			});

			if (error) {
				invalid((error.value?.message || 'Invalid or expired reset link'));
			}

			redirect(303, '/login', { reset: 'success' });
		} catch (err) {
			if (err && typeof err === 'object' && ('status' in err || 'location' in err || 'issues' in err)) {
				throw err;
			}
			console.error('[auth.remote:resetPasswordRemote] Unexpected Error:', err);
			invalid(`Unable to connect to server: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again later.`);
		}
	}
);

const checkDebtSchema = v.object({
	phoneNumber: v.pipe(v.string(), v.minLength(9), v.maxLength(20))
});

export const checkDebtRemote = form(
	toStandardSchema(checkDebtSchema),
	async ({ phoneNumber }) => {
		const event = getRequestEvent();
		const { fetch } = event;

		try {
			const api = createTreatyClient(fetch);
			// Public route at /v1/public/debts/check
			const { data, error } = await api.v1.public.debts.check.get({
				query: { phone: phoneNumber }
			});

			if (error) {
				invalid((error.value?.message || 'Failed to check debts'));
			}

			const result = data?.data as { hasDebts?: boolean; phone?: string; isRegistered?: boolean } | undefined;
			return {
				hasDebts: result?.hasDebts ?? false,
				phone: result?.phone ?? phoneNumber,
				isRegistered: result?.isRegistered ?? false
			};
		} catch (err) {
			console.error('[auth.remote:checkDebtRemote] Error:', err);
			invalid(`Unable to connect to server: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again later.`);
		}
	}
);
