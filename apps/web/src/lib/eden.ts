import { treaty } from '@elysiajs/eden';
import type { App } from '@repo/api';
import { API_URL, getDefaultHeaders } from './api';

export const createApi = (fetcher?: typeof fetch, token?: string) => {
	return treaty<App>(API_URL, {
		fetcher,
		fetch: {
			credentials: 'include' // Send cookies with cross-origin requests
		},
		headers: {
			...getDefaultHeaders(), // Always include Origin/Referer for CSRF
			...(token ? { Authorization: `Bearer ${token}` } : {})
		}
	});
};
