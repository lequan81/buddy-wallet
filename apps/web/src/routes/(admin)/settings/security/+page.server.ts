import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { SessionsResponse } from '@repo/types/shared/user';

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

	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- EdenTreaty type inference workaround
	const sessionsRoute = (locals.api.v1 as any).auth?.sessions;

	let sessionsData: SessionsResponse | null = null;
	let sessionError = null;

	if (typeof sessionsRoute?.get === 'function') {
		const { data, error } = await sessionsRoute.get();
		sessionsData = { data: data?.data, message: data?.message }.data;
		sessionError = error ? (error.value?.message || 'Failed to load sessions') : null;
	}

	return {
		sessions: sessionsData?.sessions || [],
		currentSessionId: sessionsData?.currentSessionId || '',
		error: sessionError
	};
};

