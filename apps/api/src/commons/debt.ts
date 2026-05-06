/**
 * Debt Service Utilities
 */
import type { ExpiryOption } from '@repo/types';

export type DebtStatus = 'pending' | 'confirmed' | 'paid' | 'disputed' | 'cancelled';

export interface Debt {
  id: string;
  debtorPhone: string;
  creditorPhone: string;
  debtorId: string | null;
  creditorId: string | null;
  uploadedById: string;
  amount: number;
  currency: string;
  description: string | null;
  status: DebtStatus;
  confirmedByCreditor: boolean;
  confirmedByDebtor: boolean;
  needsConfirmation: boolean;
  creditorConfirmedAt: Date | null;
  debtorConfirmedAt: Date | null;
  hasPendingProof: boolean;
  proofCount: number;
  lastProofUploadedAt: Date | null;
  expiresAt: Date | null;
  suggestedAmount: number | null;
  suggestedDescription: string | null;
  suggestedById: string | null;
  suggestedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

/**
 * Transform debt to detailed format (includes all fields)
 */
export const toDebtDetails = (debt: Debt) => ({
  id: debt.id,
  debtorPhone: debt.debtorPhone,
  creditorPhone: debt.creditorPhone,
  debtorId: debt.debtorId,
  creditorId: debt.creditorId,
  uploadedById: debt.uploadedById,
  amount: debt.amount,
  currency: debt.currency,
  description: debt.description,
  status: debt.status,
  confirmedByCreditor: debt.confirmedByCreditor,
  confirmedByDebtor: debt.confirmedByDebtor,
  needsConfirmation: debt.needsConfirmation,
  creditorConfirmedAt: debt.creditorConfirmedAt,
  debtorConfirmedAt: debt.debtorConfirmedAt,
  hasPendingProof: debt.hasPendingProof,
  proofCount: debt.proofCount,
  lastProofUploadedAt: debt.lastProofUploadedAt,
  expiresAt: debt.expiresAt,
  suggestedAmount: debt.suggestedAmount,
  suggestedDescription: debt.suggestedDescription,
  suggestedById: debt.suggestedById,
  suggestedAt: debt.suggestedAt,
  createdAt: debt.createdAt,
  updatedAt: debt.updatedAt,
  deletedAt: debt.deletedAt
});

/**
 * Transform list of debts to detailed format
 */
export const toDebtDetailsList = (debts: Debt[]) => debts.map(toDebtDetails);

/**
 * Transform debt to summary format (minimal fields for list views)
 */
export const toDebtSummary = (debt: Debt) => ({
  id: debt.id,
  debtorPhone: debt.debtorPhone,
  creditorPhone: debt.creditorPhone,
  amount: debt.amount,
  currency: debt.currency,
  description: debt.description,
  status: debt.status,
  createdAt: debt.createdAt,
  expiresAt: debt.expiresAt
});

/**
 * Transform list of debts to summary format
 */
export const toDebtSummaryList = (debts: Debt[]) => debts.map(toDebtSummary);
