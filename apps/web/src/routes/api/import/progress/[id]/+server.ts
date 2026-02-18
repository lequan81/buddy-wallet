import { API_URL, getAuthHeaders } from '$lib/api';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals, fetch }) => {
	const { id } = params;

	try {
		// Just forward the request to the backend
		const res = await fetch(`${API_URL}/v1/import/progress/${id}`, {
			headers: getAuthHeaders(locals.accessToken) as Record<string, string>
		});

		if (!res.ok) {
			// Forward the error status
			const errData = await res.json().catch(() => ({}));
			return json(
				{ success: false, message: errData.message || 'Failed to fetch progress' },
				{ status: res.status }
			);
		}

		const data = await res.json();
		// Unwrap successResponse envelope: { success, data: { ... } } → { ... }
		const payload = data.data ?? data;
		return json(payload);
	} catch (err) {
		console.error('[API Proxy] Progress error:', err);
		return json({ success: false, message: 'Internal Server Error' }, { status: 500 });
	}
};
