/**
 * Debt Service Utilities
 *
 * Shared helper functions for debt services.
 * Works with DebtEntity (repository layer) rather than ORM-specific types.
 */
import type { DebtDetails, ExpiryOption } from '@repo/types';
import type { DebtEntity } from '../../repositories';

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

const EXPIRY_DAYS: Record<'7d' | '30d' | '90d', number> = {
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
 * Maps a DebtEntity (with Dates) to a DebtDetails DTO (with ISO strings).
 * This is the single serialization point — no other code should convert dates manually.
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
    status: entity.status,
    needsConfirmation: entity.needsConfirmation,
    confirmedByCreditor: entity.confirmedByCreditor,
    confirmedByDebtor: entity.confirmedByDebtor,
    hasPendingProof: entity.hasPendingProof,
    proofCount: entity.proofCount,
    suggestedAmount: entity.suggestedAmount,
    suggestedDescription: entity.suggestedDescription,
    suggestedById: entity.suggestedById,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
    creditorConfirmedAt: entity.creditorConfirmedAt?.toISOString() || null,
    debtorConfirmedAt: entity.debtorConfirmedAt?.toISOString() || null,
    lastProofUploadedAt: entity.lastProofUploadedAt?.toISOString() || null,
    expiresAt: entity.expiresAt?.toISOString() || null,
    suggestedAt: entity.suggestedAt?.toISOString() || null,
    deletedAt: entity.deletedAt?.toISOString() || null,
  };
}
