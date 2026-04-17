import type { PageServerLoad, Actions } from './$types';
import type { SessionsResponse } from '@repo/types/core/user';
import { fail, redirect } from '@sveltejs/kit';
import { changePasswordSchema, v } from '@repo/validation/client';

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

	const { api } = locals;
		const { data, error } = await (locals.api.v1.auth as any).sessions.index.get();
	const sessionData = data as SessionsResponse | undefined;

	return {
		sessions: sessionData?.sessions || [],
		currentSessionId: sessionData?.currentSessionId || '',
		error: error ? error.value : null
	};
};
