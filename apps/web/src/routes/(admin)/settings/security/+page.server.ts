import type { PageServerLoad } from './$types';
import type { SessionsResponse } from '@repo/types/core/user';
import { fail, redirect } from '@sveltejs/kit';
import { extractApiData, extractApiErrorMessage } from '$lib/services/api-envelope';

type SessionIndexRoute = {
	get: () => Promise<{ data: unknown; error: { value: unknown } | null }>;
};

type AuthApi = {
	auth?: {
		sessions?: {
			index?: SessionIndexRoute;
		};
	};
};

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		if (locals.apiOffline) {
			return {
				sessions: [],
				currentSessionId: '',
				error: 'Backend API is unavailable'
			};
		}

		throw redirect(302, '/login');
	}

	const authApi = locals.api.v1 as unknown as AuthApi;
	const sessionsRoute = authApi.auth?.sessions?.index;

	if (!sessionsRoute?.get) {
		return {
			sessions: [],
			currentSessionId: '',
			error: 'Session endpoint is not available'
		};
	}

	const { data, error } = await sessionsRoute.get();
	const sessionData = extractApiData<SessionsResponse>(data).data;

	return {
		sessions: sessionData?.sessions || [],
		currentSessionId: sessionData?.currentSessionId || '',
		error: error ? extractApiErrorMessage(error.value, 'Failed to load sessions') : null
	};
};
