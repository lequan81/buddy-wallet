/**
 * Client-side error handling hook
 *
 * Catches all unhandled errors on the client and logs them.
 * Returns user-friendly error messages to display in the UI.
 */
import type { HandleClientError } from '@sveltejs/kit';

export const handleError: HandleClientError = async ({ error, event, status, message }) => {
	// Log error to console in development
	console.error('[Client Error]', {
		error,
		status,
		message,
		url: event.url.pathname
	});

	// In production, send to error tracking service
	// await sendToErrorTracking({ error, status, url: event.url.pathname });

	// Return user-friendly error
	return {
		message: 'An unexpected error occurred. Please refresh the page.',
		code: 'CLIENT_ERROR'
	};
};
