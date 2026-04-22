/**
 * Debt Service Utilities
 */
import type { ExpiryOption } from '@repo/types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export { toDebtDetails, toDebtDetailsList, toDebtSummary, toDebtSummaryList } from '../mappers/debt';

const EXPIRY_DAYS: Record<string, number> = {
  '1d': 1,
  '3d': 3,
  '7d': 7,
  '30d': 30,
  '90d': 90
};

/**
 * Calculate expiry date from option string.
 */
export function calculateExpiryDate(option: ExpiryOption): Date | null {
  if (option === 'never') return null;
  const days = EXPIRY_DAYS[option];
  if (!days) return null;
  return new Date(Date.now() + days * MS_PER_DAY);
}


