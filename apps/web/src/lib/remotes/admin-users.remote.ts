import { form, getRequestEvent } from '$app/server';
import { invalid } from '@sveltejs/kit';
import type { UserResponse } from '@repo/types/core/user';
import { extractApiData, extractApiErrorMessage } from '$lib/services/api-envelope';

export const toggleUserStatus = form(async () => {
	const { locals, params } = getRequestEvent();

	if (!locals.user || locals.user.role !== 'admin') {
		invalid('Access denied');
	}

	const userId = params.id;
	if (!userId) {
		invalid('User ID not found in URL');
	}

	const { data: userData, error: userError } = await locals.api.v1.user.admin.users({ id: userId }).get();
	if (userError) {
		invalid(extractApiErrorMessage(userError.value, 'User not found'));
	}

	const user = extractApiData<UserResponse>(userData).data;
	if (!user) {
		invalid('User not found');
	}

	const nextIsActive = !(user.isActive !== false);
	const { error: apiError } = await locals.api.v1.user.admin.users({ id: userId }).patch({
		isActive: nextIsActive
	});

	if (apiError) {
		invalid(extractApiErrorMessage(apiError.value, 'Failed to update status'));
	}

	return { success: true, isActive: nextIsActive };
});

