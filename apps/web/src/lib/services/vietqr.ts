import type { VietQRBank } from '@repo/types';
import { FRONTEND_CONSTANTS } from '@repo/config/frontend';

/**
 * Fetch supported banks with frontend-first strategy
 *
 * 1. Tries VietQR API directly (fast, reduces backend load)
 * 2. On timeout/error, falls back to provided backend function
 */
export async function fetchBanks(
	backendFallbackFn?: () => Promise<VietQRBank[]>
): Promise<VietQRBank[]> {
	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), FRONTEND_CONSTANTS.VIETQR_TIMEOUT);

		const response = await fetch(FRONTEND_CONSTANTS.VIETQR_API_URL, { signal: controller.signal });
		clearTimeout(timeoutId);

		if (response.ok) {
			const result = await response.json();
			if (result.code === '00' && Array.isArray(result.data)) {
				return result.data;
			}
		}
	} catch (err) {
		console.warn('[VietQR] API timeout or error, using backend fallback:', err);
	}

	// Fallback to backend if provided
	if (backendFallbackFn) {
		return backendFallbackFn();
	}

	return [];
}
