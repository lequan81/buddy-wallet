/**
 * Debt Service Utilities
 * 
 * Shared helper functions for debt services
 */
import type { Debt, DebtDetails } from '@repo/types';

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

const EXPIRY_DAYS: Record<'7d' | '30d' | '90d', number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90
};

export type ExpiryOption = 'never' | '7d' | '30d' | '90d';

/**
 * Calculate expiry date from option
 */
export function calculateExpiryDate(option: ExpiryOption): Date | null {
  if (option === 'never') return null;
  const days = EXPIRY_DAYS[option];
  if (!days) return null;
  return new Date(Date.now() + days * MS_PER_DAY);
}

/**
 * Maps a raw Drizzle Debt object (with Dates) to a DebtDetails DTO (with strings)
 */
export function toDebtDetails(debt: Debt): DebtDetails {
  return {
    ...debt,
    createdAt: debt.createdAt.toISOString(),
    updatedAt: debt.updatedAt.toISOString(),
    creditorConfirmedAt: debt.creditorConfirmedAt?.toISOString() || null,
    debtorConfirmedAt: debt.debtorConfirmedAt?.toISOString() || null,
    lastProofUploadedAt: debt.lastProofUploadedAt?.toISOString() || null,
    expiresAt: debt.expiresAt?.toISOString() || null,
    suggestedAt: debt.suggestedAt?.toISOString() || null,
    deletedAt: debt.deletedAt?.toISOString() || null,
  };
}
