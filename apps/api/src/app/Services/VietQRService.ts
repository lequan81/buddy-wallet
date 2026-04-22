/**
 * VietQR Service
 *
 * Handles integration with VietQR API for:
 * - Fetching list of supported banks
 * - Generating QR codes (via URL construction)
 */
import { injectable } from 'tsyringe';
import { MAJOR_BANKS_FALLBACK } from '@repo/config';
import { cache } from '@infra/Redis';
import { log } from '@repo/logger';
import { configs } from '@/config';

/** VietQR bank info returned by the API */
export interface VietQRBank {
  id: number;
  name: string;
  code: string;
  bin: string;
  shortName: string;
  logo: string;
  transferSupported?: number;
  lookupSupported?: number;
  swift_code?: string;
}

/** VietQR API Response envelope */
export interface VietQRResponse {
  code: string;
  desc: string;
  data: VietQRBank[];
}

const VIETQR_API_URL = 'https://api.vietqr.io/v2/banks';

@injectable()
export class VietQRService {
  /**
   * Get list of supported banks
   * 1. Try Redis cache
   * 2. Try VietQR API (backend fallback for frontend)
   * 3. Return hardcoded fallback
   */
  async getBanks(): Promise<VietQRBank[]> {
    const cacheKey = 'vietqr:banks';

    // 1. Check Redis cache (cache.get already parses JSON)
    const cached = await cache.get<VietQRBank[]>(cacheKey);
    if (cached && Array.isArray(cached)) {
      return cached;
    }

    // 2. Try VietQR API with timeout
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), configs.AUTH.FETCH_TIMEOUT_MS);

      const Response = await fetch(VIETQR_API_URL, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (Response.ok) {
        const result = (await Response.json()) as VietQRResponse;

        if (result.code === '00' && result.data.length > 0) {
          // Cache fresh data (cache.set handles JSON.stringify internally)
          await cache.set(cacheKey, result.data, configs.CACHE.VIETQR_TTL);
          return result.data;
        }
      }
    } catch (error) {
      log.warn('VIETQR', 'API timeout or error, using fallback', { error: String(error) });
    }

    // 3. Last resort: return hardcoded major banks from shared package
    return MAJOR_BANKS_FALLBACK;
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

  /**
   * Generate QR URL for debt payment
   */
  generateDebtPaymentQR(params: {
    bankBin: string;
    accountNumber: string;
    accountName: string;
    amount: number;
    debtId: string;
    debtorName?: string;
  }): string {
    // Description format: BW-<Last8CharsOfDebtId> <DebtorName>
    // VietQR description limit is usually short (often 25-50 chars depends on bank)
    const shortId = params.debtId.slice(-8);
    const description = `BW-${shortId}${params.debtorName ? ` ${params.debtorName}` : ''}`;

    return this.generateQRUrl({
      bankBin: params.bankBin,
      accountNumber: params.accountNumber,
      accountName: params.accountName,
      amount: params.amount,
      description: description.slice(0, 25), // Safe limit
      template: 'compact2'
    });
  }
}

