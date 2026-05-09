import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { SessionsResponse } from '@repo/types/core/user';
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

	let sessionsData: SessionsResponse | null = null;
	let sessionError = null;

	if (sessionsRoute?.get) {
		const { data, error } = await sessionsRoute.get();
		sessionsData = extractApiData<SessionsResponse>(data).data;
		sessionError = error ? extractApiErrorMessage(error.value, 'Failed to load sessions') : null;
	}

	return {
		sessions: sessionsData?.sessions || [],
		currentSessionId: sessionsData?.currentSessionId || '',
		error: sessionError
	};
};
