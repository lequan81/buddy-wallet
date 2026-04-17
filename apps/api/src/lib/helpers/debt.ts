/**
 * Debt Service Utilities
 */
import type { DebtDetails, ExpiryOption } from '@repo/types';
import type { Debt as DebtEntity } from '@repo/db';

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
 * Maps a DebtEntity to a DebtDetails DTO.
 */
export function toDebtDetails(entity: DebtEntity): DebtDetails {
  return {
    id: entity.id,
    debtorPhone: entity.debtorPhone,
    creditorPhone: entity.creditorPhone,
    debtorId: entity.debtorId,
    creditorId: entity.creditorId,
    uploadedById: entity.uploadedById,
    amount: entity.amount,
    description: entity.description ?? '',
    status: entity.status as any,
    needsConfirmation: entity.needsConfirmation ?? false,
    confirmedByCreditor: entity.confirmedByCreditor ?? false,
    confirmedByDebtor: entity.confirmedByDebtor ?? false,
    hasPendingProof: (entity as any).hasPendingProof ?? false,
    proofCount: (entity as any).proofCount ?? 0,
    suggestedAmount: entity.suggestedAmount,
    suggestedDescription: entity.suggestedDescription,
    suggestedById: entity.suggestedById,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
    creditorConfirmedAt: entity.creditorConfirmedAt?.toISOString() || null,
    debtorConfirmedAt: entity.debtorConfirmedAt?.toISOString() || null,
    lastProofUploadedAt: (entity as any).lastProofUploadedAt?.toISOString() || null,
    expiresAt: entity.expiresAt?.toISOString() || null,
    suggestedAt: entity.suggestedAt?.toISOString() || null,
    lastSyncAt: null,
    deletedAt: entity.deletedAt?.toISOString() || null,
  };
}
