import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import type { AdminPermissions } from '$lib/types/permissions';

// Admin pages: SSR only (user-specific data)
export const ssr = true;

export const load: LayoutServerLoad = async ({ locals, url }) => {
	// Redirect to login if not authenticated
	if (!locals.user) {
		throw redirect(303, `/login?redirect=${encodeURIComponent(url.pathname)}`);
	}

	const { user } = locals;
	const permissions = user.permissions || [];

	// Compute permissions on SERVER - cannot be tampered
	const adminPermissions: AdminPermissions = {
		isAdmin: user.role === 'admin',
		canManageUsers: user.role === 'admin' || permissions.includes('users:manage'),
		canViewAnalytics: user.role === 'admin' || permissions.includes('analytics:view'),
		canImportData: user.role === 'admin' || permissions.includes('data:import'),
		canExportData: user.role === 'admin' || permissions.includes('data:export')
	};

	return {
		user,
		permissions: adminPermissions
	};
};
