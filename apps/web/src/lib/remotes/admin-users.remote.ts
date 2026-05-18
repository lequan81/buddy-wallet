import { form, getRequestEvent } from '$app/server';
import { invalid } from '@sveltejs/kit';
import type { UserResponse } from '@repo/types/shared/user';
import { unwrapData } from '$lib/services/api-helpers';

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
		invalid((userError.value?.message || 'User not found'));
	}

	const user = unwrapData<UserResponse>(userData);
	if (!user) {
		invalid('User not found');
	}

	const nextIsActive = !(user.isActive !== false);
	const { error: apiError } = await locals.api.v1.user.admin.users({ id: userId }).patch({
		isActive: nextIsActive
	});

	if (apiError) {
		invalid((apiError.value?.message || 'Failed to update status'));
	}

	return { success: true, isActive: nextIsActive };
});


