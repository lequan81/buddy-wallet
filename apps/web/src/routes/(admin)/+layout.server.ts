import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import type { AdminPermissions } from '@repo/types/infrastructure';

// Admin pages: SSR only (user-specific data)
export const ssr = true;

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const emptyPermissions: AdminPermissions = {
		isAdmin: false,
		canManageUsers: false,
		canViewAnalytics: false,
		canImportData: false,
		canExportData: false
	};

	// Redirect to login if not authenticated
	if (!locals.user) {
		if (locals.apiOffline) {
			return {
				user: null,
				permissions: emptyPermissions,
				apiOffline: true
			};
		}

		throw redirect(303, `/login?redirect=${encodeURIComponent(url.pathname)}`);
	}

	const { user } = locals;
	const permissions = user.permissions || [];

	// Compute permissions on SERVER - cannot be tampered
	const adminPermissions: AdminPermissions = {
		isAdmin: user.role === 'admin',
		canManageUsers:
			user.role === 'admin' ||
			permissions.includes('admin:manage-users') ||
			permissions.includes('users:manage'),
		canViewAnalytics: user.role === 'admin' || permissions.includes('analytics:view'),
		canImportData:
			user.role === 'admin' ||
			permissions.includes('admin:import') ||
			permissions.includes('data:import') ||
			permissions.includes('debt:create'),
		canExportData:
			user.role === 'admin' ||
			permissions.includes('admin:view') ||
			permissions.includes('data:export')
	};

	return {
		user,
		permissions: adminPermissions,
		apiOffline: locals.apiOffline
	};
};
