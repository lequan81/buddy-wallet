import type { ErrorInfo } from '$lib/types/errors';
import { errorConfig, defaultErrorInfo } from './data';

export type { ErrorInfo };
export { errorConfig, defaultErrorInfo };

export function getErrorInfo(status: number): ErrorInfo {
	return errorConfig[status] || defaultErrorInfo;
}

export function getErrorMessage(status: number, errorMessage?: string): string {
	if (errorMessage) return errorMessage;

	switch (status) {
		case 401:
			return 'Please log in to continue.';
		case 403:
			return 'Contact support if you believe you should have access.';
		case 404:
			return 'The page you are looking for might have been removed or is temporarily unavailable.';
		default:
			if (status >= 500) return 'Our team has been notified and is working on a fix.';
			return 'Please try again or contact support if the problem persists.';
	}
}
