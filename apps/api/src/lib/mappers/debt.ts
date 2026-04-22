/**
 * Debt Mapper - Domain Transformations
 *
 * Handles transformation between Database Debt entities and domain DebtDetails objects.
 */
import type { Debt as DebtEntity } from '@repo/db';
import type { DebtDetails, DebtStatus } from '@repo/types';

/**
 * Maps a DebtEntity to a DebtDetails DTO.
 * Converts Date objects to ISO strings and handles null values.
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
    currency: entity.currency,
    description: entity.description ?? '',
    status: entity.status as DebtStatus,
    needsConfirmation: entity.needsConfirmation ?? false,
    confirmedByCreditor: entity.confirmedByCreditor ?? false,
    confirmedByDebtor: entity.confirmedByDebtor ?? false,
    hasPendingProof: (entity as { hasPendingProof?: boolean }).hasPendingProof ?? false,
    proofCount: (entity as { proofCount?: number }).proofCount ?? 0,
    suggestedAmount: entity.suggestedAmount,
    suggestedDescription: entity.suggestedDescription,
    suggestedById: entity.suggestedById,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
    creditorConfirmedAt: entity.creditorConfirmedAt?.toISOString() || null,
    debtorConfirmedAt: entity.debtorConfirmedAt?.toISOString() || null,
    lastProofUploadedAt: (entity as { lastProofUploadedAt?: Date | null }).lastProofUploadedAt?.toISOString() || null,
    expiresAt: entity.expiresAt?.toISOString() || null,
    suggestedAt: entity.suggestedAt?.toISOString() || null,
    lastSyncAt: null,
    deletedAt: entity.deletedAt?.toISOString() || null,
  };
}

/**
 * Map multiple debt entities to DebtDetails DTOs
 */
export function toDebtDetailsList(entities: DebtEntity[]): DebtDetails[] {
  return entities.map(toDebtDetails);
}

/**
 * Map debt entity to a summary DTO (for list views)
 * Excludes less critical fields for smaller payload
 */
export function toDebtSummary(entity: DebtEntity): Omit<DebtDetails, 'lastSyncAt' | 'lastProofUploadedAt'> {
  const details = toDebtDetails(entity);
  const { lastSyncAt: _lastSyncAt, lastProofUploadedAt: _lastProofUploadedAt, ...summary } = details;
  return summary;
}

/**
 * Map multiple debt entities to summary DTOs
 */
export function toDebtSummaryList(entities: DebtEntity[]): ReturnType<typeof toDebtSummary>[] {
  return entities.map(toDebtSummary);
}
