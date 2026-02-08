import type { VietQRBank } from '@repo/interfaces';

const VIETQR_API = 'https://api.vietqr.io/v2/banks';
const TIMEOUT = 5000;

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
		const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

		const response = await fetch(VIETQR_API, { signal: controller.signal });
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
