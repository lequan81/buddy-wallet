import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, fetch, request }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	// Only admins can access user management
	if (locals.user.role !== 'admin') {
		throw redirect(302, '/dashboard');
	}

	const cookie = request.headers.get('cookie') || '';

	const response = await fetch('http://localhost:3000/v1/users', {
		headers: { cookie }
	});

	if (!response.ok) {
		return { users: [], error: 'Failed to fetch users' };
	}

	const data = await response.json();

	return { users: data.users || [] };
};
