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
