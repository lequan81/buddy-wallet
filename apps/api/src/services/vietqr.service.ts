/**
 * VietQR Service
 *
 * Handles integration with VietQR API for:
 * - Fetching list of supported banks
 * - Generating QR codes (via URL construction)
 */
import { cache } from '@plugins/redis';
import { log } from '@utils/logger';

interface VietQRBank {
  id: number;
  name: string;
  code: string;
  bin: string;
  shortName: string;
  logo: string;
  transferSupported: number;
  lookupSupported: number;
}

interface VietQRResponse {
  code: string;
  desc: string;
  data: VietQRBank[];
}

const VIETQR_API_URL = 'https://api.vietqr.io/v2/banks';
const CACHE_TTL = 86400; // 24 hours

export class VietQRService {
  /**
   * Get list of supported banks from VietQR
   * Caches results in Redis for 24 hours
   */
  async getBanks(): Promise<VietQRBank[]> {
    const cacheKey = 'vietqr:banks';

    // Check cache
    const cached = await cache.get<string>(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        log.error('VIETQR', 'Failed to parse cached banks', { error: String(e) });
      }
    }

    try {
      const response = await fetch(VIETQR_API_URL);
      if (!response.ok) {
        throw new Error(`VietQR API error: ${response.statusText}`);
      }

      const result = (await response.json()) as VietQRResponse;

      if (result.code !== '00') {
        throw new Error(`VietQR API error code: ${result.code} - ${result.desc}`);
      }

      // Cache result
      await cache.set(cacheKey, JSON.stringify(result.data), CACHE_TTL);

      return result.data;
    } catch (error) {
      log.error('VIETQR', 'Failed to fetch banks', { error: String(error) });
      // Fallback: return empty array or retry? For now empty.
      return [];
    }
  }

  /**
   * Generate VietQR URL for payment
   * Format: https://img.vietqr.io/image/<BANK_BIN>-<ACCOUNT_NO>-<TEMPLATE>.png?amount=<AMOUNT>&addInfo=<INFO>&accountName=<NAME>
   */
  generateQRUrl(params: {
    bankBin: string;
    accountNumber: string;
    amount?: number;
    description?: string;
    accountName?: string;
    template?: 'compact' | 'compact2' | 'qr_only' | 'print';
  }): string {
    const {
      bankBin,
      accountNumber,
      amount,
      description,
      accountName,
      template = 'compact2'
    } = params;

    const baseUrl = `https://img.vietqr.io/image/${bankBin}-${accountNumber}-${template}.png`;
    const searchParams = new URLSearchParams();

    if (amount) searchParams.append('amount', amount.toString());
    if (description) searchParams.append('addInfo', description);
    if (accountName) searchParams.append('accountName', accountName);

    const queryString = searchParams.toString();
    return queryString ? `${baseUrl}?${queryString}` : baseUrl;
  }
}

export const vietqrService = new VietQRService();
